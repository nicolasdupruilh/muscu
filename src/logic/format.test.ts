import { describe, expect, it } from 'vitest'
import { formatKg, formatReps, formatRest, formatSet } from './format'

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

describe('séries', () => {
  it("s'affichent selon l'unité", () => {
    expect(formatSet(30, 10, 'kg')).toBe('30 kg × 10')
    expect(formatSet(2.5, 8, 'bodyweight+kg')).toBe('PDC + 2,5 kg × 8')
    expect(formatSet(0, 8, 'bodyweight+kg')).toBe('PDC × 8')
    expect(formatSet(undefined, 12, 'bodyweight')).toBe('12 reps')
    expect(formatSet(undefined, 8, 'time')).toBe('8 s')
    // Charge pas encore choisie (exercice jamais fait).
    expect(formatSet(undefined, 10, 'kg')).toBe('10 reps')
  })
})
