/**
 * Where the session screen was left: the open exercise and the values typed into the set not
 * yet marked. Kept in localStorage, so leaving the app (Instagram, a call, the phone killing it
 * in the background) and coming back, also through the rest notification, lands on the same
 * set with the same numbers instead of a closed list.
 */

/** Values typed into the active set, tied to the exact set they were typed for. */
export interface SetDraft {
  /** `${exerciseIndex}:${rowIndex}`. */
  at: string
  weight: string
  reps: string
  rir: number | null
  ramp: boolean
}

interface SessionUi {
  workoutId: string
  focus: number | null
  draft: SetDraft | null
}

const KEY = 'forja.session-ui'

function read(): SessionUi | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SessionUi) : null
  } catch {
    return null
  }
}

function write(workoutId: string, patch: Partial<Omit<SessionUi, 'workoutId'>>) {
  const prev = read()
  const base: SessionUi =
    prev?.workoutId === workoutId ? prev : { workoutId, focus: null, draft: null }
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...base, ...patch }))
  } catch {
    /* private mode: the screen still works, it just starts fresh next time */
  }
}

/** The exercise left open in this workout; undefined when there is nothing saved for it. */
export function savedFocus(workoutId: string): number | null | undefined {
  const s = read()
  return s?.workoutId === workoutId ? s.focus : undefined
}

export function saveFocus(workoutId: string, focus: number | null) {
  write(workoutId, { focus })
}

export function savedDraft(workoutId: string, at: string): SetDraft | null {
  const s = read()
  return s?.workoutId === workoutId && s.draft?.at === at ? s.draft : null
}

export function saveDraft(workoutId: string, draft: SetDraft | null) {
  write(workoutId, { draft })
}
