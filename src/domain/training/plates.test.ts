import { describe, expect, it } from 'vitest'
import { DEFAULT_PLATES, platesPerSide } from './plates'

describe('platesPerSide', () => {
  it('loads exact totals heaviest first', () => {
    expect(platesPerSide(100)).toEqual({ perSide: [25, 15], remainder: 0 })
    expect(platesPerSide(140)).toEqual({ perSide: [25, 25, 10], remainder: 0 })
    expect(platesPerSide(82.5)).toEqual({ perSide: [25, 5, 1.25], remainder: 0 })
    expect(platesPerSide(62.5)).toEqual({ perSide: [20, 1.25], remainder: 0 })
    expect(platesPerSide(25)).toEqual({ perSide: [2.5], remainder: 0 })
  })

  it('the bar alone and lighter than the bar', () => {
    expect(platesPerSide(20)).toEqual({ perSide: [], remainder: 0 })
    expect(platesPerSide(15)).toEqual({ perSide: [], remainder: -5 })
  })

  it('reports what cannot be loaded', () => {
    expect(platesPerSide(83)).toEqual({ perSide: [25, 5, 1.25], remainder: 0.5 })
    expect(platesPerSide(21)).toEqual({ perSide: [], remainder: 1 })
  })

  it('supports other bars and plate sets', () => {
    expect(platesPerSide(60, 15)).toEqual({ perSide: [20, 2.5], remainder: 0 })
    expect(platesPerSide(50, 10, [10, 5])).toEqual({ perSide: [10, 10], remainder: 0 })
    expect(platesPerSide(47, 20, [10, 5, 0, -1])).toEqual({ perSide: [10], remainder: 7 })
    expect(platesPerSide(30, 20, [5, 5, 2.5])).toEqual({ perSide: [5], remainder: 0 })
  })

  it('handles invalid totals', () => {
    expect(platesPerSide(Number.NaN)).toEqual({ perSide: [], remainder: 0 })
  })

  it('exposes the default set', () => {
    expect(DEFAULT_PLATES).toEqual([25, 20, 15, 10, 5, 2.5, 1.25])
  })
})
