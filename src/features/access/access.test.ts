import { describe, expect, it } from 'vitest'
import { accessVerdict } from './data'

describe('accessVerdict', () => {
  it('waits for the first answer', () => {
    expect(accessVerdict(undefined, false)).toBe('loading')
  })

  it('lets an approved account in and stops the rest', () => {
    expect(accessVerdict({ status: 'approved', is_admin: false }, false)).toBe('open')
    expect(accessVerdict({ status: 'pending', is_admin: false }, false)).toBe('pending')
    expect(accessVerdict({ status: 'rejected', is_admin: false }, false)).toBe('rejected')
  })

  it('treats an account without a row as pending', () => {
    expect(accessVerdict(null, false)).toBe('pending')
  })

  it('does not lock anyone out when the row cannot be read (the database still guards)', () => {
    expect(accessVerdict(undefined, true)).toBe('open')
    // A known answer wins over a later failed refresh.
    expect(accessVerdict({ status: 'pending', is_admin: false }, true)).toBe('pending')
  })
})
