import { describe, expect, it } from 'vitest'
import { legWeek, upperBody } from '../data'
import { chooseVariant, durationFactor, durationSamples, formatDuration, realDurationMin, type DurationSample } from './variants'

const legB = legWeek(1)!.sessions.B.variants // 1 h (65), 1 h 30 (105), complète (135)
const legA = legWeek(1)!.sessions.A.variants // 1 h (65), complète (120)
const push = upperBody.templates.find((t) => t.id === 'push')!.variants // 1 h (65), complète (95)

describe('choix de la variante', () => {
  it('prend la plus complète qui tient dans le temps disponible', () => {
    expect(chooseVariant(legB, 120).id).toBe('1h30')
    expect(chooseVariant(legB, 105).id).toBe('1h30')
    expect(chooseVariant(legB, 150).id).toBe('complete')
    expect(chooseVariant(legA, 90).id).toBe('1h')
    expect(chooseVariant(push, 120).id).toBe('complete')
  })

  it('prend la plus courte si rien ne tient, la complète sans limite', () => {
    expect(chooseVariant(legB, 45).id).toBe('1h')
    expect(chooseVariant(legB, 60).id).toBe('1h') // 65 min > 60 : la plus courte quand même
    expect(chooseVariant(legB, null).id).toBe('complete')
  })

  it('tient compte du coefficient de correction', () => {
    // Avec mes séances 20 % plus longues que prévu, la 1 h 30 (105 → 126 min) ne tient plus en 2 h.
    expect(chooseVariant(legB, 120, 1.2).id).toBe('1h')
    // 10 % plus rapides : la complète de push (95 → 86 min) tient en 1 h 30.
    expect(chooseVariant(push, 90, 0.9).id).toBe('complete')
  })
})

describe('coefficient de durée', () => {
  const sample = (day: number, estimatedMin: number, realMin: number): DurationSample => ({
    endedAt: `2026-10-${String(day).padStart(2, '0')}T20:00:00Z`,
    estimatedMin,
    realMin,
  })

  it('vaut 1 sans séance', () => {
    expect(durationFactor([])).toEqual({ factor: 1, count: 0 })
  })

  it('est la médiane de réel ÷ estimé', () => {
    expect(durationFactor([sample(1, 60, 66), sample(2, 100, 120), sample(3, 65, 65)])).toEqual({ factor: 1.1, count: 3 })
    expect(durationFactor([sample(1, 100, 110), sample(2, 100, 130)])).toEqual({ factor: 1.2, count: 2 })
  })

  it('écarte les séances aberrantes et ne garde que les 8 dernières', () => {
    const old = Array.from({ length: 8 }, (_, i) => sample(i + 1, 100, 150)) // anciennes, × 1,5
    const recent = Array.from({ length: 8 }, (_, i) => sample(i + 11, 100, 100)) // récentes, × 1
    const outliers = [sample(20, 60, 20), sample(21, 60, 200)] // interrompue, oubliée ouverte
    expect(durationFactor([...old, ...recent, ...outliers])).toEqual({ factor: 1, count: 8 })
  })

  it('repart de 1 après une remise à zéro', () => {
    const s = [sample(1, 100, 130), sample(2, 100, 130), sample(5, 100, 105)]
    expect(durationFactor(s, '2026-10-03T00:00:00Z')).toEqual({ factor: 1.05, count: 1 })
    expect(durationFactor(s, '2026-10-06T00:00:00Z')).toEqual({ factor: 1, count: 0 })
  })
})

describe('durées en clair', () => {
  it('s’affichent en heures et minutes', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(65)).toBe('1 h 05')
    expect(formatDuration(120)).toBe('2 h')
    expect(formatDuration(134.6)).toBe('2 h 15')
  })
})

describe('durée réelle', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 10, h, m).toISOString()
  const variant = { id: '1h', label: '1 h', estimatedMin: 65, abdosRounds: 2 }

  it('compte les abdos enchaînés dans la durée d’un push', () => {
    const push = { id: 1, type: 'push' as const, status: 'terminee' as const, date: at(18), endedAt: at(18, 55), variant }
    const abs = { id: 2, type: 'abdos' as const, status: 'terminee' as const, date: at(18, 56), endedAt: at(19, 6), parentSessionId: 1 }
    expect(realDurationMin(push, [push, abs])).toBe(66)
    expect(durationSamples([push, abs])).toEqual([{ endedAt: push.endedAt, estimatedMin: 65, realMin: 66 }])
  })

  it('ignore les séances sans variante ou pas terminées', () => {
    const old = { id: 3, type: 'pull' as const, status: 'terminee' as const, date: at(10), endedAt: at(11) }
    const ongoing = { id: 4, type: 'jambes' as const, status: 'en-cours' as const, date: at(12), variant }
    expect(durationSamples([old, ongoing])).toEqual([])
  })
})
