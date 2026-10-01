import { describe, expect, it } from 'vitest'
import { formatKg, formatReps, formatRest } from './format'

describe('formats', () => {
  it('affiche les temps de repos', () => {
    expect(formatRest(45)).toBe('45 s')
    expect(formatRest(60)).toBe('1 min')
    expect(formatRest(90)).toBe('1 min 30')
    expect(formatRest(150)).toBe('2 min 30')
  })
  it('affiche reps et charges', () => {
    expect(formatReps(6)).toBe('6 reps')
    expect(formatReps(1)).toBe('1 rep')
    expect(formatReps('8/côté')).toBe('8/côté')
    expect(formatKg(72.5)).toBe('72,5 kg')
  })
})
