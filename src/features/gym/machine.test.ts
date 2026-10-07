import { describe, expect, it } from 'vitest'
import { fileSlug, machineUrl, modelsFor, parseSettings, serializeSettings } from './machine'

describe('machine settings', () => {
  it('round-trips named settings', () => {
    const text = serializeSettings([
      { name: 'Asiento', value: '4' },
      { name: 'Respaldo', value: '2' },
      { name: '', value: 'agarre neutro' },
    ])
    expect(text).toBe('Asiento: 4 · Respaldo: 2 · agarre neutro')
    expect(parseSettings(text)).toEqual([
      { name: 'Asiento', value: '4' },
      { name: 'Respaldo', value: '2' },
      { name: '', value: 'agarre neutro' },
    ])
  })

  it('reads old free text and other separators', () => {
    expect(parseSettings('asiento 3')).toEqual([{ name: '', value: 'asiento 3' }])
    expect(parseSettings('Asiento:5;Rodillo: B\nPies: alto')).toEqual([
      { name: 'Asiento', value: '5' },
      { name: 'Rodillo', value: 'B' },
      { name: 'Pies', value: 'alto' },
    ])
    expect(parseSettings(null)).toEqual([])
  })

  it('drops empty values and strips separators from names', () => {
    expect(serializeSettings([{ name: 'Asiento', value: ' ' }])).toBeNull()
    expect(serializeSettings([{ name: 'A·B', value: '1;2' }])).toBe('A B: 1 2')
  })
})

describe('machine links', () => {
  it('builds the hash deep link from the current location', () => {
    expect(machineUrl('abc', { origin: 'https://jmpastor2.github.io', pathname: '/jmfit/' })).toBe(
      'https://jmpastor2.github.io/jmfit/#/m/abc',
    )
    expect(machineUrl('x', { origin: 'http://localhost:5173', pathname: '/' })).toBe(
      'http://localhost:5173/#/m/x',
    )
  })

  it('makes safe file names', () => {
    expect(fileSlug('Press hombro (Pure) ñ')).toBe('press-hombro-pure-n')
    expect(fileSlug('***')).toBe('maquina')
  })

  it('suggests models for a known line, case-insensitive', () => {
    expect(modelsFor('hammer strength mts')).toContain('Iso-Lateral Biceps Curl')
    expect(modelsFor('Otra marca')).toEqual([])
  })
})
