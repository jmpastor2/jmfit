import { beforeEach, describe, expect, it } from 'vitest'
import { saveDraft, saveFocus, savedDraft, savedFocus } from './sessionUi'

const draft = { at: '1:cable-crossover:0', weight: '17,5', reps: '10', rir: 1, ramp: false }

beforeEach(() => localStorage.clear())

describe('session screen state', () => {
  it('gives back the open exercise of the same workout only', () => {
    expect(savedFocus('w1')).toBeUndefined()
    saveFocus('w1', 2)
    expect(savedFocus('w1')).toBe(2)
    expect(savedFocus('w2')).toBeUndefined()
    saveFocus('w1', null)
    expect(savedFocus('w1')).toBeNull()
  })

  it('gives back typed values only for the set they were typed for', () => {
    saveFocus('w1', 1)
    saveDraft('w1', draft)
    expect(savedDraft('w1', draft.at)).toEqual(draft)
    expect(savedDraft('w1', '1:cable-crossover:1')).toBeNull()
    expect(savedFocus('w1')).toBe(1)
    saveDraft('w1', null)
    expect(savedDraft('w1', draft.at)).toBeNull()
  })

  it('a new workout starts clean', () => {
    saveDraft('w1', draft)
    saveFocus('w2', 0)
    expect(savedDraft('w2', draft.at)).toBeNull()
    expect(savedDraft('w1', draft.at)).toBeNull()
  })
})
