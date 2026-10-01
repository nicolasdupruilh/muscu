import { describe, expect, it } from 'vitest'
import type { SetLog } from '../db/models'
import { applyRestAdjustment, formatClock, lastChosenRest, lastRestReference, remainingMs, restAdjustment, restTaken } from './rest'

const set = (p: Partial<SetLog>): SetLog => ({ sessionId: 1, planKey: 'k', exerciseId: 'dc-halteres', setNumber: 1, done: true, at: '2026-10-01T18:00:00Z', ...p })

describe('repos de la dernière fois', () => {
  it('reprend le dernier repos choisi pour cet exercice', () => {
    const logs = [
      set({ sessionId: 1, restPlannedSec: 120, at: '2026-10-01T18:00:00Z' }),
      set({ sessionId: 2, restPlannedSec: 150, at: '2026-10-05T18:00:00Z' }),
      set({ sessionId: 3, restPlannedSec: 60, at: '2026-10-08T18:00:00Z' }),
      set({ sessionId: 4, exerciseId: 'autre', restPlannedSec: 30, at: '2026-10-09T18:00:00Z' }),
    ]
    expect(lastChosenRest(logs, 'dc-halteres', 3)).toBe(150)
    expect(lastChosenRest(logs, 'dc-halteres')).toBe(60)
    expect(lastChosenRest(logs, 'jamais-fait')).toBeUndefined()
  })

  it('compare au repos réellement pris entre les séries, sinon au repos choisi', () => {
    expect(
      lastRestReference([
        set({ setNumber: 1, restTakenSec: 400, restPlannedSec: 120 }),
        set({ setNumber: 2, restTakenSec: 130, restPlannedSec: 120 }),
        set({ setNumber: 3, restTakenSec: 110, restPlannedSec: 120 }),
      ]),
    ).toBe(120)
    expect(lastRestReference([set({ setNumber: 1, restPlannedSec: 90 })])).toBe(90)
    expect(lastRestReference([set({ setNumber: 1 })])).toBeUndefined()
  })
})

describe('ajustement selon le repos', () => {
  it("ne change rien si le repos n'est pas nettement plus court", () => {
    expect(restAdjustment(120, 120)).toBeUndefined()
    expect(restAdjustment(90, 120)).toBeUndefined() // −25 %
    expect(restAdjustment(60, undefined)).toBeUndefined()
  })

  it('retire 1 rep à partir de 30 % de moins, 2 reps à partir de la moitié', () => {
    expect(restAdjustment(84, 120)?.reduceBy).toBe(1) // −30 %
    expect(restAdjustment(60, 120)?.reduceBy).toBe(2) // −50 %
    expect(restAdjustment(60, 120)?.message).toBe(
      'Repos plus court que la dernière fois (1 min au lieu de 2 min) : vise 2 reps de moins, à la même charge.',
    )
  })

  it('applique la charge de la dernière fois et retire les reps', () => {
    const target = { sets: [{ loadKg: 32, value: 6 }, { loadKg: 32, value: 6 }], reason: '+2 kg', increased: true }
    const last = [{ loadKg: 30, value: 10 }, { loadKg: 30, value: 2 }]
    const t = applyRestAdjustment(target, last, { reduceBy: 2, message: 'm' })
    expect(t.sets).toEqual([{ loadKg: 30, value: 8 }, { loadKg: 30, value: 1 }])
    expect(t.increased).toBe(false)
    expect(t.reason).toBe('m')
  })
})

describe('chrono', () => {
  const start = Date.parse('2026-10-01T18:00:00Z')
  it("se calcule à partir de l'heure de fin", () => {
    const endsAt = '2026-10-01T18:01:30Z'
    expect(formatClock(remainingMs(endsAt, start))).toBe('1:30')
    expect(formatClock(remainingMs(endsAt, start + 500))).toBe('1:30')
    expect(formatClock(remainingMs(endsAt, start + 89_100))).toBe('0:01')
    expect(formatClock(remainingMs(endsAt, start + 90_000))).toBe('0:00')
    expect(formatClock(remainingMs(endsAt, start + 102_000))).toBe('+0:12')
  })

  it('mesure le repos réellement pris', () => {
    const rest = { startedAt: '2026-10-01T18:00:00Z' }
    expect(restTaken(rest, start + 95_000)).toBe(95)
    expect(restTaken({ ...rest, endedAt: '2026-10-01T18:02:00Z' }, start + 300_000)).toBe(120)
    expect(restTaken(undefined, start)).toBeUndefined()
  })
})
