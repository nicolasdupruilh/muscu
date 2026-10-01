import { describe, expect, it } from 'vitest'
import type { Session, SetLog } from '../db/models'
import { estimated1RM, exerciseHistory, kneeHistory, metricsFor, sessionSummary } from './stats'

const session = (id: number, date: string, p: Partial<Session> = {}): Session => ({
  id,
  date,
  endedAt: date.replace('T18', 'T19'),
  type: 'push',
  status: 'terminee',
  ...p,
})
const set = (sessionId: number, setNumber: number, loadKg: number, reps: number, p: Partial<SetLog> = {}): SetLog => ({
  sessionId,
  planKey: 'k',
  exerciseId: 'dc-halteres',
  setNumber,
  loadKg,
  reps,
  done: true,
  at: `2026-10-0${sessionId}T18:0${setNumber}:00Z`,
  ...p,
})

describe('1RM estimé', () => {
  it('suit la formule d’Epley', () => {
    expect(estimated1RM(100, 1)).toBe(100)
    expect(estimated1RM(100, 10)).toBe(133.5)
    expect(estimated1RM(30, 8)).toBe(38)
  })
})

describe('courbe d’un exercice', () => {
  const sessions = [session(1, '2026-10-01T18:00:00Z'), session(2, '2026-10-05T18:00:00Z'), session(3, '2026-10-08T18:00:00Z', { status: 'en-cours' })]
  const logs = [
    set(1, 1, 30, 10),
    set(1, 2, 32, 6),
    set(2, 1, 32, 8),
    set(2, 2, 32, 7),
    set(3, 1, 40, 8), // séance en cours : ignorée
    set(2, 3, 50, 1, { exerciseId: 'autre' }),
  ]

  it('garde la meilleure série de chaque séance terminée', () => {
    const [rm] = metricsFor('kg')
    const points = exerciseHistory(logs, sessions, 'dc-halteres', rm)
    expect(points.map((p) => [p.sessionId, p.value])).toEqual([
      [1, 40], // 30 × 10 → 40 bat 32 × 6 → 38,5
      [2, 40.5],
    ])
    expect(points[0].best.loadKg).toBe(30)
    expect(points[0].sets).toHaveLength(2)
  })

  it('peut suivre la charge max à la place', () => {
    const charge = metricsFor('kg').find((m) => m.id === 'charge')!
    expect(exerciseHistory(logs, sessions, 'dc-halteres', charge).map((p) => p.value)).toEqual([32, 32])
  })

  it('propose des mesures adaptées au type de charge', () => {
    expect(metricsFor('bodyweight+kg').map((m) => m.id)).toEqual(['lest', 'reps'])
    expect(metricsFor('time').map((m) => m.id)).toEqual(['duree'])
    expect(metricsFor('none').map((m) => m.id)).toEqual(['reps'])
  })
})

describe('résumé de séance', () => {
  it('compte exercices, séries et durée', () => {
    const s = session(1, '2026-10-01T18:00:00Z')
    expect(sessionSummary(s, [set(1, 1, 30, 10), set(1, 2, 30, 9), set(1, 1, 10, 12, { planKey: 'k2' })])).toEqual({
      exercises: 2,
      sets: 3,
      minutes: 60,
    })
  })
})

describe('courbe du genou', () => {
  it('reprend les checks des séances jambes', () => {
    const sessions = [
      session(2, '2026-10-05T18:00:00Z', { type: 'jambes', kneeCheck: { pendant: 3, lendemain: 1 } }),
      session(1, '2026-10-01T18:00:00Z', { type: 'jambes', kneeCheck: { pendant: 2 } }),
      session(3, '2026-10-06T18:00:00Z'),
    ]
    expect(kneeHistory(sessions)).toEqual([
      { sessionId: 1, date: '2026-10-01T18:00:00Z', pendant: 2, lendemain: undefined },
      { sessionId: 2, date: '2026-10-05T18:00:00Z', pendant: 3, lendemain: 1 },
    ])
  })
})
