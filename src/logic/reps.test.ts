import { describe, expect, it } from 'vitest'
import { describeReps, entryMode, parseReps } from './reps'

describe('reps prescrites', () => {
  it('lisent toutes les formes des programmes', () => {
    expect(parseReps(6)).toMatchObject({ kind: 'reps', value: 6, perSide: false })
    expect(parseReps('8/côté')).toMatchObject({ kind: 'reps', value: 8, perSide: true })
    expect(parseReps('6-8')).toMatchObject({ kind: 'reps', value: 6, max: 8 })
    expect(parseReps('20 s')).toMatchObject({ kind: 'time', value: 20 })
    expect(parseReps('25 s/côté')).toMatchObject({ kind: 'time', value: 25, perSide: true })
    expect(parseReps('10 min')).toMatchObject({ kind: 'time', value: 600 })
    expect(parseReps('15 m')).toMatchObject({ kind: 'distance', value: 15 })
    expect(parseReps('max')).toMatchObject({ kind: 'text', text: 'max' })
  })

  it("s'affichent en clair", () => {
    expect(describeReps(parseReps('8/côté'))).toBe('8 reps par côté')
    expect(describeReps(parseReps('6-10'))).toBe('6 à 10 reps')
    expect(describeReps(parseReps('25 s/côté'))).toBe('25 s par côté')
    expect(describeReps(parseReps('10 min'))).toBe('10 min')
    expect(describeReps(parseReps('15 m'))).toBe('15 m')
    expect(describeReps(parseReps(1))).toBe('1 rep')
  })

  it('choisissent la saisie selon le type et l’unité', () => {
    expect(entryMode(parseReps(6), 'kg')).toBe('reps')
    expect(entryMode(parseReps('20 s'), 'time')).toBe('time')
    expect(entryMode(parseReps('10 min'), 'none')).toBe('check') // échauffement
    expect(entryMode(parseReps('15 m'), 'kg')).toBe('check') // traîneau
  })
})
