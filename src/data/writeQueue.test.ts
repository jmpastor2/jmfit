import { MutationObserver, type QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient, isTransientError, shouldRetryWrite } from '@/lib/queryClient'
import { setSupabaseClient, type TypedSupabase } from '@/lib/supabase'
import { registerMutationDefaults } from './hooks'
import { onWriteError } from './writeErrors'

type Result = { error: { code?: string; message: string } | null }

/** A client whose upserts answer what `answer` says, after `delayMs`, and log when they run. */
function stubClient(answer: (rows: { id: string }[]) => { result: Result; delayMs?: number }) {
  const log: string[] = []
  const client = {
    from: () => ({
      upsert: (rows: { id: string }[]) => {
        const id = rows[0]!.id
        log.push(`start ${id}`)
        const { result, delayMs = 0 } = answer(rows)
        return new Promise<Result>((resolve) =>
          setTimeout(() => {
            log.push(`end ${id}`)
            resolve(result)
          }, delayMs),
        )
      },
    }),
  }
  return { client: client as unknown as TypedSupabase, log }
}

function upsert(qc: QueryClient, id: string, table = 'workout_sets') {
  return new MutationObserver<void, unknown, object>(qc, { mutationKey: ['upsert'] }).mutate({
    table,
    rows: [{ id }],
  })
}

let qc: QueryClient
beforeEach(() => {
  qc = createQueryClient()
  const defaults = qc.getDefaultOptions()
  qc.setDefaultOptions({ ...defaults, mutations: { ...defaults.mutations, retryDelay: 0 } })
  registerMutationDefaults(qc)
})
afterEach(() => {
  setSupabaseClient(null)
  qc.clear()
})

describe('isTransientError', () => {
  it('retries what never reached the database', () => {
    expect(isTransientError({ message: 'TypeError: Failed to fetch', code: '' })).toBe(true)
    expect(isTransientError({ message: '<html>502 Bad Gateway</html>' })).toBe(true)
    expect(isTransientError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isTransientError({ code: 'PGRST002', message: 'schema cache' })).toBe(true)
    expect(isTransientError({ code: 'PGRST301', message: 'JWT expired' })).toBe(true)
  })

  it('stops on a real answer from the database or the auth server', () => {
    expect(isTransientError({ code: '42501', message: 'row-level security' })).toBe(false)
    expect(isTransientError({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isTransientError({ code: 'PGRST116', message: 'no rows' })).toBe(false)
    expect(isTransientError({ status: 403, message: 'forbidden' })).toBe(false)
    expect(isTransientError({ status: 429, message: 'slow down' })).toBe(true)
  })

  it('bounds the attempts', () => {
    expect(shouldRetryWrite(5, { code: '' })).toBe(true)
    expect(shouldRetryWrite(1000, { code: '' })).toBe(false)
    expect(shouldRetryWrite(0, { code: '42501' })).toBe(false)
  })
})

describe('write queue', () => {
  it('sends writes one at a time, in the order they were made', async () => {
    // The first write is slow: without the shared scope the second would overtake it.
    const { client, log } = stubClient((rows) => ({
      result: { error: null },
      delayMs: rows[0]!.id === 'workout' ? 30 : 0,
    }))
    setSupabaseClient(client)
    await Promise.all([upsert(qc, 'workout', 'workouts'), upsert(qc, 'set-1'), upsert(qc, 'set-2')])
    expect(log).toEqual([
      'start workout',
      'end workout',
      'start set-1',
      'end set-1',
      'start set-2',
      'end set-2',
    ])
  })

  it('keeps retrying a write that cannot reach the server', async () => {
    let attempts = 0
    const { client } = stubClient(() => {
      attempts++
      return {
        result:
          attempts < 4 ? { error: { code: '', message: 'Failed to fetch' } } : { error: null },
      }
    })
    setSupabaseClient(client)
    await upsert(qc, 'set-1')
    expect(attempts).toBe(4)
  })

  it('stops at once on a database error, reports it and refetches what it touched', async () => {
    let attempts = 0
    const { client } = stubClient(() => {
      attempts++
      return { result: { error: { code: '42501', message: 'row-level security' } } }
    })
    setSupabaseClient(client)
    const messages: string[] = []
    const off = onWriteError((m) => messages.push(m))
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    await expect(upsert(qc, 'set-1')).rejects.toMatchObject({ code: '42501' })
    off()
    expect(attempts).toBe(1)
    expect(messages).toEqual(['No se pudo guardar: sin permiso'])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sets'] })
  })

  it('a quiet write is not reported (the screen says it), but still refetched', async () => {
    const { client } = stubClient(() => ({
      result: { error: { code: '23505', message: 'duplicate' } },
    }))
    setSupabaseClient(client)
    const messages: string[] = []
    const off = onWriteError((m) => messages.push(m))
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    await expect(
      new MutationObserver<void, unknown, object>(qc, { mutationKey: ['upsert'] }).mutate({
        table: 'workouts',
        rows: [{ id: 'w' }],
        quiet: true,
      }),
    ).rejects.toBeTruthy()
    off()
    expect(messages).toEqual([])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['workouts'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sets'] })
  })
})
