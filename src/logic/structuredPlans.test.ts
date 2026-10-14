import { describe, expect, it } from 'vitest'
import { absBlockForWeek, absProgram, catalogue, legPhase } from '../data'
import type { PlannedExercise, SetLog } from '../db/models'
import { absTarget, buildAbsPlan, buildPhasePlan, legTarget } from './structuredPlans'
import { nextSet } from './supersets'

const isJump = (id: string) => catalogue.exercises.find((e) => e.id === id)?.category === 'plyo'
/** Exercices d'une séance de phase, pour une variante. */
const itemsOf = (phaseId: string, week: number, label: 'A' | 'B', variant = 'complete') =>
  legPhase(phaseId)!.weeks!.find((w) => w.week === week)!.sessions[label].variants.find((v) => v.id === variant)!.items

describe('séance jambes par phases', () => {
  it('reprend exactement la prescription de la semaine', () => {
    const { plan, hidden } = buildPhasePlan(itemsOf('p1', 2, 'A'), { week: 2, lendemain: 1, isJump })
    expect(plan.find((p) => p.exerciseId === 'squat-arriere')).toMatchObject({ sets: 4, repRange: [8, 8], targetLoadKg: 70, tempo: '3-0-3-0' })
    expect(plan.find((p) => p.exerciseId === 'squat-unipodal-incline')).toMatchObject({ prescribedReps: 8 })
    expect(hidden).toEqual([])
  })

  it('exercice optionnel : proposé si la condition est remplie, masqué sinon', () => {
    const rn = (o: { week: number; lendemain?: number }) => {
      const { plan, hidden } = buildPhasePlan(itemsOf('p1', o.week, 'A'), { ...o, isJump })
      return { planned: plan.find((p) => p.exerciseId === 'reverse-nordic'), hidden }
    }
    expect(rn({ week: 1, lendemain: 0 })).toEqual({ planned: undefined, hidden: [{ exerciseId: 'reverse-nordic', condition: 'semaine>=2 et lendemain<=2' }] })
    expect(rn({ week: 2, lendemain: 2 }).planned).toMatchObject({ optional: true, condition: 'semaine>=2 et lendemain<=2' })
    expect(rn({ week: 2, lendemain: 3 }).planned).toBeUndefined()
    expect(rn({ week: 3 }).planned).toBeUndefined() // lendemain inconnu
  })

  it('semaine répétée : la charge ajoutée s’applique aux charges cibles et se voit', () => {
    const { plan } = buildPhasePlan(itemsOf('p1', 3, 'A'), { week: 3, lendemain: 1, loadBonusKg: 2.5, isJump })
    const squat = plan.find((p) => p.exerciseId === 'squat-arriere')!
    expect(squat.targetLoadKg).toBe(75) // 72,5 + 2,5
    expect(squat.adjustmentNote).toBe('Semaine répétée : +2,5 kg sur la charge cible (72,5 kg prévus).')
    expect(plan.find((p) => p.exerciseId === 'presse-lente')?.targetLoadKg).toBeUndefined()
  })

  it('garde-fou : les sauts sont sautés par défaut, avec la raison', () => {
    const { plan } = buildPhasePlan(itemsOf('p2', 1, 'A'), { week: 1, isJump, jumpNote: 'Séance avec sauts hier.' })
    const jumps = plan.filter((p) => p.skipped)
    expect(jumps.map((p) => p.exerciseId)).toEqual(['reception-bipodale-figee', 'sauts-faibles-bipodaux', 'pogos', 'drop-landing-unipodal'])
    expect(jumps.every((p) => p.adjustmentNote === 'Séance avec sauts hier.')).toBe(true)
    expect(plan.find((p) => p.exerciseId === 'squat-arriere')?.skipped).toBeUndefined()
  })

  it('variante 1 h : supersets conservés', () => {
    const { plan } = buildPhasePlan(itemsOf('p1', 1, 'A', '1h'), { week: 1, isJump })
    expect(plan.filter((p) => p.superset === 'S1').map((p) => p.exerciseId)).toEqual(['squat-unipodal-incline', 'step-down', 'mollets-unipodal'])
  })

  describe('cible de charge', () => {
    const { plan } = buildPhasePlan(itemsOf('p2', 2, 'A'), { week: 2, isJump })
    const squat = plan.find((p) => p.exerciseId === 'squat-arriere')! // 4 × 6 à 75 kg
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
  const plan = buildAbsPlan(absBlockForWeek(1)!, absProgram.restBetweenRoundsSec)
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
    expect(buildAbsPlan(absBlockForWeek(9)!, 60).map((p) => p.exerciseId)).toContain('slam')
    // Variante du haut du corps : abdosRounds remplace le nombre de tours.
    expect(buildAbsPlan(absBlockForWeek(1)!, 60, 2).map((p) => p.sets)).toEqual([2, 2, 2, 2])
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
    while ((next = nextSet(plan, (k) => counts[k] ?? 0))) {
      order.push(`${next.round}:${next.key}`)
      counts[next.key] = (counts[next.key] ?? 0) + 1
    }
    expect(order.slice(0, 5)).toEqual(['1:abdos:0', '1:abdos:1', '1:abdos:2', '1:abdos:3', '2:abdos:0'])
    expect(order).toHaveLength(12)
  })

  it('ignore un exercice sauté', () => {
    const skipped: PlannedExercise[] = plan.map((p, i) => (i === 1 ? { ...p, skipped: true } : p))
    expect(nextSet(skipped, (k) => (k === 'abdos:0' ? 1 : 0))).toEqual({ round: 1, key: 'abdos:2', superset: 'circuit' })
  })
})
