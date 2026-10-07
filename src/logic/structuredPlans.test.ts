import { describe, expect, it } from 'vitest'
import { absBlockForWeek, catalogue, legWeek } from '../data'
import type { PlannedExercise, SetLog } from '../db/models'
import { legProgram } from '../data'
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

  it('programme v2 : pliométrie de la séance A, reps par jambe et par côté', () => {
    expect(legProgram.version).toBe(2)
    const plan = buildLegPlan(w2A, w1A, undefined, isJump)
    expect(plan.map((p) => p.exerciseId).slice(0, 6)).toEqual([
      'echauffement-jambes',
      'pogos',
      'sauts-lateraux-ligne',
      'drop-landing-unipodal',
      'box-jump',
      'skater-bound',
    ])
    expect(plan.find((p) => p.exerciseId === 'drop-landing-unipodal')).toMatchObject({ sets: 3, repRange: [8, 8], prescribedReps: '8/jambe' })
  })

  it('genou orange : sauts divisés par deux, charges de la semaine précédente', () => {
    const plan = buildLegPlan(w2A, w1A, 'orange', isJump)
    const box = plan.find((p) => p.exerciseId === 'box-jump')!
    expect(box.sets).toBe(2) // 4 → 2
    expect(plan.find((p) => p.exerciseId === 'pogos')!.sets).toBe(2) // 3 → 2 (arrondi au-dessus)
    const squat = plan.find((p) => p.exerciseId === 'squat-arriere')!
    expect(squat.targetLoadKg).toBe(72.5)
    expect(squat.adjustmentNote).toContain('72,5 kg au lieu de 75 kg')
  })

  it('genou rouge : sauts et réceptions sautés, le reste inchangé', () => {
    const plan = buildLegPlan(w2A, w1A, 'rouge', isJump)
    expect(plan.find((p) => p.exerciseId === 'box-jump')!.skipped).toBe(true)
    expect(plan.find((p) => p.exerciseId === 'drop-landing-unipodal')!.skipped).toBe(true)
    expect(plan.find((p) => p.exerciseId === 'pogos')!.skipped).toBe(true)
    const squat = plan.find((p) => p.exerciseId === 'squat-arriere')!
    expect(squat.skipped).toBeFalsy()
    expect(squat.targetLoadKg).toBe(75)
  })

  describe('cible de charge', () => {
    const plan = buildLegPlan(w2A, w1A, undefined, isJump)
    const squat = plan.find((p) => p.exerciseId === 'squat-arriere')!
    const bulgare = plan.find((p) => p.exerciseId === 'fente-bulgare')! // 3 × 8, pas de charge cible
    const sets = (loadKg: number, ...reps: number[]): SetLog[] =>
      reps.map((r, i) => ({ sessionId: 1, planKey: 'k', exerciseId: 'x', setNumber: i + 1, loadKg, reps: r, targetReps: 8, done: true, at: '' }))

    it('le programme fait foi quand il donne une charge, la dernière charge reste indiquée', () => {
      const t = legTarget(squat, sets(74, 6, 6, 6, 6), 'kg', { incrementKg: 2.5 })
      expect(t.sets[0]).toEqual({ loadKg: 75, value: 6 })
      expect(t.reason).toBe('Charge cible du programme. Dernière fois : 74 kg.')
    })

    it('sans charge cible : +1 cran si toutes les séries étaient réussies', () => {
      const t = legTarget(bulgare, sets(15, 8, 8, 9), 'kg', { incrementKg: 2 })
      expect(t.sets[0]).toEqual({ loadKg: 17, value: 8 })
      expect(t.increased).toBe(true)
      expect(t.reason).toBe('Toutes les séries réussies la dernière fois (8, 8, 9 pour 8 visées) : +2 kg.')
    })

    it('le signale quand les séries étaient largement réussies', () => {
      expect(legTarget(bulgare, sets(15, 10, 11, 10), 'kg', { incrementKg: 2 }).reason).toMatch(/^Séries largement réussies/)
    })

    it('même charge, non arrondie, si une série a manqué', () => {
      const t = legTarget(bulgare, sets(15.5, 8, 7, 6), 'kg', { incrementKg: 2 })
      expect(t.sets[0]).toEqual({ loadKg: 15.5, value: 8 })
      expect(t.reason).toBe('Même charge que la dernière fois : toutes les séries n’étaient pas réussies (8, 7, 6 pour 8 visées).')
    })

    it('jamais d’augmentation en semaine allégée', () => {
      const t = legTarget(bulgare, sets(15, 10, 10, 10), 'kg', { incrementKg: 2, deload: true })
      expect(t.sets[0].loadKg).toBe(15)
      expect(t.reason).toBe('Semaine allégée : même charge que la dernière fois.')
    })

    it('première fois, et exercice sans charge', () => {
      expect(legTarget(bulgare, [], 'kg').reason).toBe('Première fois : choisis ta charge.')
      const box = plan.find((p) => p.exerciseId === 'box-jump')!
      expect(legTarget(box, [], 'none').sets[0]).toEqual({ loadKg: undefined, value: 5 })
    })
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
