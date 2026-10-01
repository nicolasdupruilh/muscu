import { describe, expect, it } from 'vitest'
import type { SetLog } from '../db/models'
import { lastExerciseAt, lastPerformance, toPastSets } from './history'

let id = 1
const log = (p: Partial<SetLog> & Pick<SetLog, 'sessionId' | 'exerciseId' | 'setNumber' | 'at'>): SetLog => ({
  id: id++,
  planKey: 'k',
  done: true,
  ...p,
})

const logs: SetLog[] = [
  log({ sessionId: 1, exerciseId: 'rowing-haltere', templateKey: 'pull:3', setNumber: 1, loadKg: 30, reps: 10, at: '2026-10-01T18:00:00Z' }),
  log({ sessionId: 1, exerciseId: 'rowing-haltere', templateKey: 'pull:3', setNumber: 2, loadKg: 30, reps: 9, at: '2026-10-01T18:03:00Z' }),
  log({ sessionId: 2, exerciseId: 'rowing-poulie', templateKey: 'pull:3', setNumber: 1, loadKg: 50, reps: 10, at: '2026-10-05T18:00:00Z' }),
  // Rowing haltère fait hors trame dans une autre séance, plus récente.
  log({ sessionId: 3, exerciseId: 'rowing-haltere', setNumber: 2, loadKg: 32, reps: 8, at: '2026-10-08T18:05:00Z' }),
  log({ sessionId: 3, exerciseId: 'rowing-haltere', setNumber: 1, loadKg: 32, reps: 8, at: '2026-10-08T18:02:00Z' }),
  log({ sessionId: 3, exerciseId: 'rowing-haltere', setNumber: 3, loadKg: 32, reps: 0, done: false, at: '2026-10-08T18:08:00Z' }),
]

describe('dernière perf', () => {
  it("retrouve la dernière séance de l'exercice, peu importe le slot", () => {
    const p = lastPerformance(logs, 'rowing-haltere')
    expect(p?.sessionId).toBe(3)
    expect(p?.sets.map((s) => s.setNumber)).toEqual([1, 2])
    expect(p?.at).toBe('2026-10-08T18:05:00Z')
  })

  it('ignore la séance en cours', () => {
    expect(lastPerformance(logs, 'rowing-haltere', 3)?.sessionId).toBe(1)
  })

  it('ne trouve rien pour un exercice jamais fait', () => {
    expect(lastPerformance(logs, 'face-pull')).toBeUndefined()
  })
})

describe('exercice par défaut d’une place de la trame', () => {
  it('est le dernier fait à cette place', () => {
    expect(lastExerciseAt(logs, 'pull:3')).toBe('rowing-poulie')
    expect(lastExerciseAt(logs, 'pull:4')).toBeUndefined()
  })
})

describe('conversion pour la progression', () => {
  it('prend les reps, ou la durée pour un exercice en durée', () => {
    expect(toPastSets([log({ sessionId: 1, exerciseId: 'x', setNumber: 1, loadKg: 10, reps: 8, at: '' })], 'kg')).toEqual([{ loadKg: 10, value: 8 }])
    expect(toPastSets([log({ sessionId: 1, exerciseId: 'x', setNumber: 1, durationSec: 7, at: '' })], 'time')).toEqual([{ loadKg: undefined, value: 7 }])
    expect(toPastSets([log({ sessionId: 1, exerciseId: 'x', setNumber: 1, reps: 6, at: '' })], 'bodyweight+kg')).toEqual([{ loadKg: 0, value: 6 }])
  })
})
