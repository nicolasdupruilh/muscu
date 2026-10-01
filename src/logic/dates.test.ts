import { describe, expect, it } from 'vitest'
import { isSameWeek, startOfWeek, toLocalDate } from './dates'

describe('semaines calendaires', () => {
  it('commencent le lundi', () => {
    expect(toLocalDate(startOfWeek(new Date(2026, 9, 1)))).toBe('2026-09-28') // jeudi 1er octobre
    expect(toLocalDate(startOfWeek(new Date(2026, 9, 4, 23)))).toBe('2026-09-28') // dimanche soir
    expect(toLocalDate(startOfWeek(new Date(2026, 9, 5)))).toBe('2026-10-05') // lundi
  })
  it('comparent deux dates', () => {
    expect(isSameWeek(new Date(2026, 9, 4), new Date(2026, 8, 28))).toBe(true)
    expect(isSameWeek(new Date(2026, 9, 4), new Date(2026, 9, 5))).toBe(false)
  })
})
