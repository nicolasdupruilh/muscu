import { describe, expect, it } from 'vitest'
import { upperBody } from '../data'
import type { SetLog } from '../db/models'
import { buildUpperPlan, slugify } from './upperPlan'

const push = upperBody.templates.find((t) => t.id === 'push')!
const all = () => true

describe('plan de séance haut du corps', () => {
  it('suit la trame avec les exercices par défaut', () => {
    const plan = buildUpperPlan(push, [], all)
    expect(plan).toHaveLength(push.slots.length)
    expect(plan[0]).toMatchObject({ key: 'push:0', slot: 'push-horizontal', exerciseId: 'dc-halteres', sets: 3, repRange: [6, 10], restSec: 150 })
  })

  it("reprend l'exercice fait la dernière fois à chaque place, même pour deux places du même slot", () => {
    const logs: SetLog[] = [
      { sessionId: 1, planKey: 'push:5', templateKey: 'push:5', exerciseId: 'triceps-overhead', setNumber: 1, reps: 10, done: true, at: '2026-10-01' },
    ]
    const plan = buildUpperPlan(push, logs, all)
    expect(plan[5].exerciseId).toBe('triceps-overhead')
    expect(plan[6].exerciseId).toBe('triceps-corde')
  })

  it("revient à l'exercice par défaut si le dernier est archivé", () => {
    const logs: SetLog[] = [
      { sessionId: 1, planKey: 'push:0', templateKey: 'push:0', exerciseId: 'dc-barre', setNumber: 1, reps: 8, done: true, at: '2026-10-01' },
    ]
    expect(buildUpperPlan(push, logs, (id) => id !== 'dc-barre')[0].exerciseId).toBe('dc-halteres')
  })
})

it('reprend le repos choisi la dernière fois pour cet exercice', () => {
  const logs: SetLog[] = [
    { sessionId: 1, planKey: 'x', exerciseId: 'dc-halteres', setNumber: 1, reps: 8, restPlannedSec: 180, done: true, at: '2026-10-01' },
  ]
  const plan = buildUpperPlan(push, logs, all)
  expect(plan[0].restSec).toBe(180)
  expect(plan[1].restSec).toBe(120)
})

it("propose un autre exercice du slot si celui par défaut est archivé", () => {
  const plan = buildUpperPlan(push, [], (id) => id !== 'dc-halteres', (slot) => (slot === 'push-horizontal' ? 'dc-barre' : undefined))
  expect(plan[0].exerciseId).toBe('dc-barre')
  expect(plan[1].exerciseId).toBe('incline-halteres')
})

describe('identifiant d’exercice', () => {
  it('est lisible et unique', () => {
    expect(slugify('Curl araignée', () => false)).toBe('curl-araignee')
    expect(slugify('Pull-over (poulie)', () => false)).toBe('pull-over-poulie')
    expect(slugify('Dips', (id) => id === 'dips' || id === 'dips-2')).toBe('dips-3')
    expect(slugify('!!!', () => false)).toBe('exercice')
  })
})
