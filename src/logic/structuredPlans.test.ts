import { describe, expect, it } from 'vitest'
import { absBlockForWeek, catalogue, legWeek } from '../data'
import type { PlannedExercise, SetLog } from '../db/models'
import { absTarget, buildAbsPlan, buildLegPlan, circuitNext, legTarget } from './structuredPlans'

const isJump = (id: string) => catalogue.exercises.find((e) => e.id === id)?.category === 'plyo'
const w2A = legWeek(2)!.sessions.A
const w1A = legWeek(1)!.sessions.A

describe('séance jambes', () => {
  it('reprend exactement la prescription', () => {
    const plan = buildLegPlan(w2A, w1A, undefined, isJump)
    const squat = plan.find((p) => p.exerciseId === 'squat-arriere')!
    expect(squat).toMatchObject({ sets: 4, repRange: [6, 6], targetLoadKg: 75, tempo: '3-0-X-0', restSec: 180 })
    expect(plan.every((p) => !p.adjustmentNote && !p.skipped)).toBe(true)
  })

  it('genou orange : sauts divisés par deux, charges de la semaine précédente', () => {
    const plan = buildLegPlan(w2A, w1A, 'orange', isJump)
    const box = plan.find((p) => p.exerciseId === 'box-jump')!
    expect(box.sets).toBe(2) // 4 → 2
    expect(plan.find((p) => p.exerciseId === 'drop-landing-30')!.sets).toBe(2) // 3 → 2 (arrondi au-dessus)
    const squat = plan.find((p) => p.exerciseId === 'squat-arriere')!
    expect(squat.targetLoadKg).toBe(72.5)
    expect(squat.adjustmentNote).toContain('72,5 kg au lieu de 75 kg')
  })

  it('genou rouge : sauts et réceptions sautés, le reste inchangé', () => {
    const plan = buildLegPlan(w2A, w1A, 'rouge', isJump)
    expect(plan.find((p) => p.exerciseId === 'box-jump')!.skipped).toBe(true)
    expect(plan.find((p) => p.exerciseId === 'drop-landing-30')!.skipped).toBe(true)
    const squat = plan.find((p) => p.exerciseId === 'squat-arriere')!
    expect(squat.skipped).toBeFalsy()
    expect(squat.targetLoadKg).toBe(75)
  })

  it('cible : charge du programme, sinon celle de la dernière fois', () => {
    const plan = buildLegPlan(w2A, w1A, undefined, isJump)
    const squat = plan.find((p) => p.exerciseId === 'squat-arriere')!
    expect(legTarget(squat, [{ loadKg: 70, value: 6 }], 'kg').sets[0]).toEqual({ loadKg: 75, value: 6 })
    const bulgare = plan.find((p) => p.exerciseId === 'fente-bulgare')!
    const t = legTarget(bulgare, [{ loadKg: 16, value: 8 }], 'kg')
    expect(t.sets[0]).toEqual({ loadKg: 16, value: 8 })
    expect(t.reason).toBe('Charge de la dernière fois.')
    expect(legTarget(bulgare, [], 'kg').reason).toBe('Première fois : choisis ta charge.')
    const box = plan.find((p) => p.exerciseId === 'box-jump')!
    expect(legTarget(box, [], 'none').sets[0]).toEqual({ loadKg: undefined, value: 3 })
  })
})

describe('séance abdos', () => {
  const plan = buildAbsPlan(absBlockForWeek(1)!)
  const deadBug = plan[0]
  const set = (round: number, reps: number, targetReps = 8): SetLog => ({
    sessionId: 1,
    planKey: deadBug.key,
    exerciseId: 'dead-bug',
    setNumber: round,
    reps,
    targetReps,
    done: true,
    at: '',
  })

  it('suit le bloc de la semaine', () => {
    expect(plan.map((p) => p.exerciseId)).toEqual(['dead-bug', 'releves-genoux', 'planche-laterale', 'pallof-press'])
    expect(deadBug).toMatchObject({ sets: 3, repRange: [8, 8], prescribedReps: '8/côté' })
    expect(buildAbsPlan(absBlockForWeek(9)!).map((p) => p.exerciseId)).toContain('slam')
  })

  it('+2 reps quand tous les tours étaient propres, sinon même objectif', () => {
    expect(absTarget(deadBug, [], 'none', false).sets[0].value).toBe(8)
    expect(absTarget(deadBug, [set(1, 8), set(2, 8), set(3, 9)], 'none', false).sets[0].value).toBe(10)
    expect(absTarget(deadBug, [set(1, 8), set(2, 7), set(3, 8)], 'none', false).sets[0].value).toBe(8)
    // L'objectif a déjà progressé : on repart de là.
    expect(absTarget(deadBug, [set(1, 10, 10), set(2, 10, 10), set(3, 10, 10)], 'none', false).sets[0].value).toBe(12)
  })

  it('+5 s pour un exercice en durée', () => {
    const planche = plan[2]
    const sets: SetLog[] = [1, 2, 3].map((r) => ({ ...set(r, 0, 25), planKey: planche.key, reps: undefined, durationSec: 25 }))
    expect(absTarget(planche, sets, 'time', true).sets[0].value).toBe(30)
  })

  it('enchaîne un tour de tous les exercices avant le suivant', () => {
    const counts: Record<string, number> = {}
    const order: string[] = []
    let next
    while ((next = circuitNext(plan, (k) => counts[k] ?? 0))) {
      order.push(`${next.round}:${next.key}`)
      counts[next.key] = (counts[next.key] ?? 0) + 1
    }
    expect(order.slice(0, 5)).toEqual(['1:abdos:0', '1:abdos:1', '1:abdos:2', '1:abdos:3', '2:abdos:0'])
    expect(order).toHaveLength(12)
  })

  it('ignore un exercice sauté', () => {
    const skipped: PlannedExercise[] = plan.map((p, i) => (i === 1 ? { ...p, skipped: true } : p))
    expect(circuitNext(skipped, (k) => (k === 'abdos:0' ? 1 : 0))).toEqual({ round: 1, key: 'abdos:2' })
  })
})
