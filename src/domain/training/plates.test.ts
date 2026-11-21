import { describe, expect, it } from 'vitest'
import { DEFAULT_PLATES, platesPerSide, discsPerSide, loadModel } from './plates'

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

describe('loadModel and discsPerSide', () => {
  it('counts the bar on free bars and splits the rest per side', () => {
    const bar = loadModel('barbell', 20)
    expect(bar).toMatchObject({ label: 'Kg totales', base: 20 })
    expect(discsPerSide(100, bar)).toMatchObject({ perSide: [25, 15], remainder: 0, sideKg: 40 })
    expect(discsPerSide(20, bar)).toBeNull()
    expect(discsPerSide(40, loadModel('ez_bar', 20))).toMatchObject({ perSide: [15], sideKg: 15 })
  })

  it('counts only the discs, both sides added, on disc machines and the Smith', () => {
    const machine = loadModel('plate_loaded', 20)
    expect(machine).toMatchObject({ label: 'Kg en discos', base: 0 })
    expect(discsPerSide(110, machine)).toMatchObject({ perSide: [25, 25, 5], sideKg: 55 })
    expect(discsPerSide(56, loadModel('smith', 20))).toMatchObject({
      perSide: [25, 2.5],
      remainder: 1,
      sideKg: 28,
    })
  })

  it('never splits dumbbells, stacks or cables', () => {
    expect(loadModel('dumbbell', 20)).toMatchObject({ label: 'Kg por mancuerna', base: null })
    expect(discsPerSide(30, loadModel('dumbbell', 20))).toBeNull()
    expect(discsPerSide(60, loadModel('machine', 20))).toBeNull()
    expect(discsPerSide(25, loadModel('cable', 20))).toBeNull()
  })
})
