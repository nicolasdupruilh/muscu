import { describe, expect, it } from 'vitest'
import { legProgram } from '../data'
import type { Session } from '../db/models'
import { kneeRule, lastKneeSession, needsNextDayCheck } from './knee'

const rules = legProgram.healthCheck.rules

describe('règles du check genou', () => {
  it('vert jusqu’à 2, orange jusqu’à 5, rouge au-delà', () => {
    expect(kneeRule({ pendant: 0 }, rules)?.level).toBe('vert')
    expect(kneeRule({ pendant: 2 }, rules)?.level).toBe('vert')
    expect(kneeRule({ pendant: 3 }, rules)?.level).toBe('orange')
    expect(kneeRule({ pendant: 5 }, rules)?.level).toBe('orange')
    expect(kneeRule({ pendant: 6 }, rules)?.level).toBe('rouge')
    expect(kneeRule({ pendant: 10 }, rules)?.level).toBe('rouge')
  })

  it('prend le maximum des deux réponses', () => {
    expect(kneeRule({ pendant: 1, lendemain: 4 }, rules)?.level).toBe('orange')
    expect(kneeRule({ pendant: 7, lendemain: 0 }, rules)?.level).toBe('rouge')
  })

  it('sans réponse, pas de niveau', () => {
    expect(kneeRule(undefined, rules)).toBeUndefined()
    expect(kneeRule({}, rules)).toBeUndefined()
  })
})

const leg = (p: Partial<Session>): Session => ({ type: 'jambes', status: 'terminee', date: '2026-10-01T17:00:00', ...p })

describe('question du lendemain', () => {
  const s = leg({ endedAt: '2026-10-01T18:30:00', kneeCheck: { pendant: 1 } })
  it('se pose à partir du lendemain, une seule fois', () => {
    expect(needsNextDayCheck(s, new Date(2026, 9, 1, 23))).toBe(false)
    expect(needsNextDayCheck(s, new Date(2026, 9, 2, 7))).toBe(true)
    expect(needsNextDayCheck({ ...s, kneeCheck: { pendant: 1, lendemain: 0 } }, new Date(2026, 9, 2, 7))).toBe(false)
    expect(needsNextDayCheck(undefined, new Date())).toBe(false)
  })

  it('porte sur la dernière séance jambes terminée', () => {
    const older = leg({ id: 1, endedAt: '2026-09-28T18:00:00', kneeCheck: { pendant: 4 } })
    const newer = leg({ id: 2, endedAt: '2026-10-01T18:00:00', kneeCheck: { pendant: 1 } })
    const unchecked = leg({ id: 3, endedAt: '2026-10-02T18:00:00' })
    const push: Session = { id: 4, type: 'push', status: 'terminee', date: '2026-10-03T18:00:00', endedAt: '2026-10-03T19:00:00' }
    expect(lastKneeSession([older, newer, unchecked, push])?.id).toBe(2)
  })
})
