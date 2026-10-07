// Séances cadrées : jambes (programme semaine par semaine) et abdos (circuit par blocs).

import type { AbsBlock, LegSession, LoadUnit } from '../data/types'
import type { PlannedExercise, SetLog } from '../db/models'
import type { Target } from './doubleProgression'
import { formatKg } from './format'
import type { KneeLevel } from './knee'
import { parseReps } from './reps'

const rangeOf = (reps: PlannedExercise['prescribedReps']): [number, number] => {
  const p = parseReps(reps ?? 0)
  const v = p.value ?? 1
  return [v, p.max ?? v]
}

/**
 * Plan d'une séance jambes tel que prescrit. Si le dernier check genou est orange ou rouge,
 * les ajustements sont appliqués et notés sur chaque exercice concerné :
 * - orange : sauts divisés par deux, charges de la semaine précédente ;
 * - rouge : pas de sauts ni de réceptions (exercices sautés, réactivables).
 */
export function buildLegPlan(
  session: LegSession,
  previousWeek: LegSession | undefined,
  knee: KneeLevel | undefined,
  isJump: (exerciseId: string) => boolean,
): PlannedExercise[] {
  return session.items.map((it, i) => {
    const planned: PlannedExercise = {
      key: `jambes:${i}`,
      exerciseId: it.exerciseId,
      sets: it.sets,
      repRange: rangeOf(it.reps),
      restSec: it.restSec,
      note: it.note || undefined,
      prescribedReps: it.reps,
      targetLoadKg: it.targetLoadKg,
      tempo: it.tempo,
    }
    const jump = isJump(it.exerciseId)
    if (knee === 'rouge' && jump) {
      return { ...planned, skipped: true, adjustmentNote: 'Genou rouge : pas de sauts ni de réceptions aujourd’hui.' }
    }
    if (knee === 'orange') {
      if (jump) {
        return { ...planned, sets: Math.ceil(it.sets / 2), adjustmentNote: `Genou orange : sauts divisés par deux (${Math.ceil(it.sets / 2)} séries au lieu de ${it.sets}).` }
      }
      const prev = previousWeek?.items.find((p) => p.exerciseId === it.exerciseId)?.targetLoadKg
      if (it.targetLoadKg !== undefined && prev !== undefined && prev !== it.targetLoadKg) {
        return { ...planned, targetLoadKg: prev, adjustmentNote: `Genou orange : charge de la semaine précédente (${formatKg(prev)} au lieu de ${formatKg(it.targetLoadKg)}).` }
      }
    }
    return planned
  })
}

const hasLoad = (unit: LoadUnit) => unit === 'kg' || unit === 'bodyweight+kg'

/**
 * Cible d'un exercice jambes : reps prescrites, et pour la charge :
 * - la charge cible du programme quand il en donne une (le programme fait foi) ;
 * - sinon la charge de la dernière fois, avec +1 cran si toutes les séries avaient atteint les reps visées
 *   (jamais en semaine allégée). Proposition affichée et modifiable, comme la double progression.
 * `last` : séries de la dernière séance où l'exercice a été fait.
 */
export function legTarget(
  planned: PlannedExercise,
  last: SetLog[],
  unit: LoadUnit,
  { incrementKg, deload = false }: { incrementKg?: number; deload?: boolean } = {},
): Target {
  const value = planned.repRange[0]
  const count = Math.max(planned.sets, 1)
  const make = (loadOf: (i: number) => number | undefined, reason: string, increased = false): Target => ({
    sets: Array.from({ length: count }, (_, i) => ({ loadKg: loadOf(i), value })),
    reason,
    increased,
  })
  if (!hasLoad(unit)) return make(() => undefined, '')

  const lastLoad = (i: number) => last[Math.min(i, last.length - 1)]?.loadKg ?? (unit === 'bodyweight+kg' ? 0 : undefined)
  const maxLast = last.length ? Math.max(...last.map((s) => s.loadKg ?? 0)) : undefined

  if (planned.targetLoadKg !== undefined) {
    const before = maxLast !== undefined && maxLast !== planned.targetLoadKg ? ` Dernière fois : ${formatKg(maxLast)}.` : ''
    return make(() => planned.targetLoadKg, `Charge cible du programme.${before}`)
  }
  if (last.length === 0) return make(() => (unit === 'bodyweight+kg' ? 0 : undefined), 'Première fois : choisis ta charge.')
  if (deload) return make(lastLoad, 'Semaine allégée : même charge que la dernière fois.')

  // Séries de la dernière fois comparées aux reps qui étaient visées ce jour-là.
  const withReps = last.filter((s) => s.reps !== undefined)
  if (withReps.length === 0) return make(lastLoad, 'Charge de la dernière fois.')
  const goal = (s: SetLog) => s.targetReps ?? value
  const margins = withReps.map((s) => s.reps! - goal(s))
  const detail = `${withReps.map((s) => s.reps).join(', ')} pour ${[...new Set(withReps.map(goal))].join('/')} visées`
  if (margins.every((m) => m >= 0) && incrementKg) {
    const how = margins.every((m) => m >= 2) ? 'Séries largement réussies' : 'Toutes les séries réussies'
    return make((i) => (lastLoad(i) ?? 0) + incrementKg, `${how} la dernière fois (${detail}) : +${formatKg(incrementKg)}.`, true)
  }
  return make(lastLoad, `Même charge que la dernière fois : toutes les séries n’étaient pas réussies (${detail}).`)
}

/** Plan d'une séance abdos : les exercices du bloc, un « tour » = une série de chaque. */
export function buildAbsPlan(block: AbsBlock): PlannedExercise[] {
  return block.items.map((it, i) => ({
    key: `abdos:${i}`,
    exerciseId: it.exerciseId,
    sets: it.rounds,
    repRange: rangeOf(it.reps),
    restSec: 0,
    note: it.note || undefined,
    prescribedReps: it.reps,
  }))
}

/**
 * Cible d'un exercice abdos : dans un bloc, quand tous les tours de la dernière séance étaient propres
 * (objectif atteint à chaque tour), +2 reps ou +5 s ; sinon le même objectif.
 * `lastInBlock` : séries de la dernière séance de ce bloc pour cet exercice.
 */
export function absTarget(planned: PlannedExercise, lastInBlock: SetLog[], unit: LoadUnit, isTime: boolean): Target {
  const base = planned.repRange[0]
  const step = isTime ? 5 : 2
  const unitLabel = isTime ? 's' : 'reps'
  const loadOf = (i: number) => (hasLoad(unit) ? lastInBlock[Math.min(i, lastInBlock.length - 1)]?.loadKg ?? (unit === 'bodyweight+kg' ? 0 : undefined) : undefined)
  const make = (value: number, reason: string): Target => ({
    sets: Array.from({ length: Math.max(planned.sets, 1) }, (_, i) => ({ loadKg: loadOf(i), value })),
    reason,
    increased: false,
  })

  if (lastInBlock.length === 0) return make(base, 'Objectif du programme.')
  const valueOf = (s: SetLog) => (isTime ? s.durationSec : s.reps) ?? 0
  const lastGoal = lastInBlock[0].targetReps ?? base
  const clean = lastInBlock.length >= planned.sets && lastInBlock.every((s) => valueOf(s) >= (s.targetReps ?? lastGoal))
  return clean
    ? make(lastGoal + step, `Tous les tours propres la dernière fois : +${step} ${unitLabel}.`)
    : make(lastGoal, 'Même objectif que la dernière fois (tous les tours n’étaient pas propres).')
}

/** Prochaine série du circuit : on fait un tour de tous les exercices, puis le suivant. */
export function circuitNext(plan: PlannedExercise[], doneCount: (key: string) => number): { round: number; key: string } | undefined {
  const active = plan.filter((p) => !p.skipped)
  const rounds = Math.max(0, ...active.map((p) => p.sets))
  for (let round = 1; round <= rounds; round++) {
    for (const p of active) if (p.sets >= round && doneCount(p.key) < round) return { round, key: p.key }
  }
  return undefined
}

export const circuitRounds = (plan: PlannedExercise[]) => Math.max(0, ...plan.filter((p) => !p.skipped).map((p) => p.sets))
