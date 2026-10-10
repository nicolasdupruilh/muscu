import { describe, expect, it } from 'vitest'
import type { PlannedExercise } from '../db/models'
import { groupsOf, nextSet, restAfter } from './supersets'

const ex = (key: string, sets: number, restSec: number, superset?: string, skipped?: boolean): PlannedExercise => ({
  key,
  exerciseId: key,
  sets,
  repRange: [8, 8],
  restSec,
  superset,
  skipped,
})

// Squat seul, puis superset S1 (élévations + triceps), puis curl seul.
const plan = [ex('squat', 2, 180), ex('elev', 2, 75, 'S1'), ex('tri', 2, 60, 'S1'), ex('curl', 1, 60)]

/** Rejoue toute la séance : ordre des séries et repos lancé après chacune. */
function play(p: PlannedExercise[]) {
  const done: Record<string, number> = {}
  const steps: string[] = []
  let next
  while ((next = nextSet(p, (k) => done[k] ?? 0))) {
    const rest = restAfter(p, (k) => done[k] ?? 0, next.key)
    steps.push(`${next.key}#${next.round}${rest ? ` repos ${rest}` : ''}`)
    done[next.key] = (done[next.key] ?? 0) + 1
  }
  return steps
}

describe('supersets', () => {
  it('regroupent les exercices consécutifs du même superset', () => {
    expect(groupsOf(plan).map((g) => g.map((p) => p.key))).toEqual([['squat'], ['elev', 'tri'], ['curl']])
  })

  it('enchaînent la série de chaque exercice du groupe, puis le repos du groupe', () => {
    expect(play(plan)).toEqual([
      'squat#1 repos 180',
      'squat#2 repos 180',
      'elev#1', // on enchaîne sans pause
      'tri#1 repos 75', // repos du groupe : le plus long des deux
      'elev#2',
      'tri#2 repos 75',
      'curl#1', // dernière série de la séance : pas de repos
    ])
  })

  it('font sortir du tour un exercice qui a moins de séries', () => {
    const p = [ex('drop', 2, 60, 'S0'), ex('box', 3, 90, 'S0'), ex('squat', 1, 180)]
    expect(play(p)).toEqual(['drop#1', 'box#1 repos 90', 'drop#2', 'box#2 repos 90', 'box#3 repos 90', 'squat#1'])
  })

  it('ignorent un exercice sauté', () => {
    const p = [ex('elev', 2, 75, 'S1', true), ex('tri', 2, 60, 'S1')]
    expect(play(p)).toEqual(['tri#1 repos 60', 'tri#2'])
  })

  it('servent aussi au circuit abdos (un seul groupe, repos entre les tours)', () => {
    const circuit = [ex('deadbug', 2, 60, 'circuit'), ex('releves', 2, 60, 'circuit'), ex('planche', 2, 60, 'circuit')]
    expect(play(circuit)).toEqual(['deadbug#1', 'releves#1', 'planche#1 repos 60', 'deadbug#2', 'releves#2', 'planche#2'])
  })

  it('reprennent où j’en suis si j’ai fait une série dans le désordre', () => {
    const done: Record<string, number> = { tri: 1 }
    expect(nextSet(plan, (k) => done[k] ?? 0)).toEqual({ key: 'squat', round: 1, superset: undefined })
    done.squat = 2
    expect(nextSet(plan, (k) => done[k] ?? 0)).toEqual({ key: 'elev', round: 1, superset: 'S1' })
  })
})
