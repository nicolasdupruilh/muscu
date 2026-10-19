import { describe, expect, it } from 'vitest'
import { catalogue, upperTemplate } from '../data'
import type { Exercise, Session, SetLog } from '../db/models'
import { addToFreePlan, dayExerciseIds, freePlanned } from './freePlan'

const exercises = catalogue.exercises as unknown as Exercise[]
const byId = (id: string) => exercises.find((e) => e.id === id)!
const templates = [upperTemplate('push'), upperTemplate('pull')]
const mine: Exercise = { id: 'presse-pecs', name: 'Presse pecs', category: 'push', equipment: 'machine', loadUnit: 'kg', loadIncrementKg: 5, unilateral: false, defaultRestSec: 100, slots: [], cues: '', source: 'user' } as unknown as Exercise

describe('exercices du jour', () => {
  it('ceux des slots de la trame, plus ceux déjà faits dans une séance du même type', () => {
    const sessions = [{ id: 1, type: 'push', status: 'terminee', date: '2026-10-10' }] as Session[]
    const logs = [{ sessionId: 1, planKey: 'free:1:0', exerciseId: 'presse-pecs', setNumber: 1, done: true, at: '2026-10-10' }] as SetLog[]
    const push = dayExerciseIds(upperTemplate('push'), [...exercises, mine], sessions, logs)
    expect(push).toContain('dc-halteres')
    expect(push).toContain('presse-pecs')
    expect(push).not.toContain('rowing-haltere')
    const pull = dayExerciseIds(upperTemplate('pull'), [...exercises, mine], sessions, logs)
    expect(pull).toContain('rowing-haltere')
    expect(pull).not.toContain('presse-pecs')
  })
})

describe('exercice ajouté à une séance libre', () => {
  it('jamais fait : séries, fourchette et repos de sa place dans la trame', () => {
    const slot = upperTemplate('pull').variants.at(-1)!.slots.find((s) => s.slot === 'row')!
    expect(freePlanned(byId('rowing-haltere'), templates, [], [], 'k')).toMatchObject({
      key: 'k',
      slot: 'row',
      sets: slot.sets,
      repRange: slot.repRange,
      restSec: slot.restSec,
    })
  })

  it('hors trame : 3 × 8 à 12 et son repos par défaut', () => {
    expect(freePlanned(mine, templates, [], [], 'k')).toMatchObject({ sets: 3, repRange: [8, 12], restSec: 100, slot: undefined })
  })

  it('déjà fait : les séries faites, la fourchette et le repos de la dernière fois', () => {
    const sessions = [
      { id: 1, type: 'push', status: 'terminee', date: '2026-10-10', plan: [{ key: 'a', exerciseId: 'presse-pecs', sets: 4, repRange: [10, 15], restSec: 90 }] },
    ] as Session[]
    const logs = [1, 2].map((n) => ({ sessionId: 1, planKey: 'a', exerciseId: 'presse-pecs', setNumber: n, reps: 12, restPlannedSec: 80, done: true, at: `2026-10-10T18:0${n}` })) as SetLog[]
    expect(freePlanned(mine, templates, sessions, logs, 'k')).toMatchObject({ sets: 2, repRange: [10, 15], restSec: 80 })
  })

  it('deux exercices choisis ensemble forment un nouveau superset', () => {
    const a = freePlanned(mine, templates, [], [], 'a')
    const plan = addToFreePlan(addToFreePlan([], [a, { ...a, key: 'b' }]), [{ ...a, key: 'c' }, { ...a, key: 'd' }])
    expect(plan.map((p) => p.superset)).toEqual(['S1', 'S1', 'S2', 'S2'])
    expect(addToFreePlan([], [a])[0].superset).toBeUndefined()
  })
})
