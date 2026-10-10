import { describe, expect, it } from 'vitest'
import { upperBody } from '../data'
import type { SetLog } from '../db/models'
import { buildUpperPlan, slugify } from './upperPlan'

const push = upperBody.templates.find((t) => t.id === 'push')!
const complete = push.variants.find((v) => v.id === 'complete')!
const short = push.variants.find((v) => v.id === '1h')!
const all = () => true

describe('plan de séance haut du corps', () => {
  it('suit la trame avec les exercices par défaut', () => {
    const plan = buildUpperPlan(push, complete, [], all)
    expect(plan).toHaveLength(complete.slots.length)
    expect(plan[0]).toMatchObject({ key: 'push:push-horizontal:1', slot: 'push-horizontal', exerciseId: 'dc-halteres', sets: 4, repRange: [6, 10], restSec: 150 })
    expect(plan.filter((p) => p.superset === 'S1').map((p) => p.slot)).toEqual(['pec-isolation', 'lateral-raise'])
  })

  it("reprend l'exercice fait la dernière fois à chaque place, même pour deux places du même slot", () => {
    const logs: SetLog[] = [
      { sessionId: 1, planKey: 'x', templateKey: 'push:triceps:1', exerciseId: 'triceps-overhead', setNumber: 1, reps: 10, done: true, at: '2026-10-01' },
    ]
    const plan = buildUpperPlan(push, complete, logs, all)
    expect(plan.find((p) => p.key === 'push:triceps:1')?.exerciseId).toBe('triceps-overhead')
    expect(plan.find((p) => p.key === 'push:triceps:2')?.exerciseId).toBe('triceps-corde')
    // La même place existe dans la variante 1 h, à une autre position : l'exercice suit.
    expect(buildUpperPlan(push, short, logs, all).find((p) => p.slot === 'triceps')?.exerciseId).toBe('triceps-overhead')
  })

  it("revient à l'exercice par défaut si le dernier est archivé", () => {
    const logs: SetLog[] = [
      { sessionId: 1, planKey: 'x', templateKey: 'push:push-horizontal:1', exerciseId: 'dc-barre', setNumber: 1, reps: 8, done: true, at: '2026-10-01' },
    ]
    expect(buildUpperPlan(push, complete, logs, (id) => id !== 'dc-barre')[0].exerciseId).toBe('dc-halteres')
  })
})

it('reprend le repos choisi la dernière fois pour cet exercice', () => {
  const logs: SetLog[] = [
    { sessionId: 1, planKey: 'x', exerciseId: 'dc-halteres', setNumber: 1, reps: 8, restPlannedSec: 180, done: true, at: '2026-10-01' },
  ]
  const plan = buildUpperPlan(push, complete, logs, all)
  expect(plan[0].restSec).toBe(180)
  expect(plan[1].restSec).toBe(120)
})

it("propose un autre exercice du slot si celui par défaut est archivé", () => {
  const plan = buildUpperPlan(push, complete, [], (id) => id !== 'dc-halteres', (slot) => (slot === 'push-horizontal' ? 'dc-barre' : undefined))
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
