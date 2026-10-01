import { describe, expect, it } from 'vitest'
import { nextIndex, positionOf, programLength, programStatus, toIndex, type ProgramShape } from './programs'

const legs: ProgramShape = { weeksCount: 16, sessionLabels: ['A', 'B'] }
const at = (day: number) => `2026-10-${String(day).padStart(2, '0')}T18:00:00.000Z`
const done = (...indexes: number[]) => indexes.map((index, i) => ({ index, at: at(i + 2) }))

describe('positions', () => {
  it('numérote semaine et séance', () => {
    expect(programLength(legs)).toBe(32)
    expect(positionOf(legs, 0)).toEqual({ index: 0, week: 1, slot: 0, label: 'A' })
    expect(positionOf(legs, 5)).toEqual({ index: 5, week: 3, slot: 1, label: 'B' })
    expect(toIndex(legs, 3, 1)).toBe(5)
  })
})

describe('prochaine séance', () => {
  it('commence à semaine 1 séance A', () => {
    expect(nextIndex(legs, [], {})).toBe(0)
  })

  it('avance séance par séance, sans tenir compte du calendrier', () => {
    expect(nextIndex(legs, done(0), {})).toBe(1)
    expect(nextIndex(legs, done(0, 1), {})).toBe(2)
  })

  it('ne saute pas une séance faite dans le désordre', () => {
    // B faite avant A : A reste à faire, puis on passe à la semaine 2.
    expect(nextIndex(legs, done(1), {})).toBe(0)
    expect(nextIndex(legs, done(1, 0), {})).toBe(2)
  })

  it('reprend à la position corrigée à la main', () => {
    const settings = { override: { index: toIndex(legs, 5, 0), at: at(1) } }
    expect(nextIndex(legs, [], settings)).toBe(8)
  })

  it('après une correction, ne compte que les séances faites ensuite', () => {
    // J'avais fait S1 A et S1 B, puis je décide de refaire la semaine 1.
    const history = [
      { index: 0, at: at(1) },
      { index: 1, at: at(2) },
    ]
    const settings = { override: { index: 0, at: at(3) } }
    expect(nextIndex(legs, history, settings)).toBe(0)
    expect(nextIndex(legs, [...history, { index: 0, at: at(4) }], settings)).toBe(1)
  })

  it('signale la fin du programme', () => {
    const all = Array.from({ length: 32 }, (_, i) => i)
    expect(nextIndex(legs, done(...all), {})).toBe(32)
    expect(programStatus(legs, done(...all), {}).finished).toBe(true)
  })
})

describe('état de la semaine', () => {
  it('montre ce qui est fait et ce qui reste', () => {
    const s = programStatus(legs, done(0, 1, 2), {})
    expect(s.next?.week).toBe(2)
    expect(s.week.map((w) => [w.position.label, w.done, w.next])).toEqual([
      ['A', true, false],
      ['B', false, true],
    ])
  })

  it('marque comme passées les séances avant une correction', () => {
    const s = programStatus(legs, [], { override: { index: toIndex(legs, 4, 1), at: at(1) } })
    expect(s.next).toMatchObject({ week: 4, label: 'B' })
    expect(s.week.map((w) => [w.done, w.skipped])).toEqual([
      [false, true],
      [false, false],
    ])
  })
})
