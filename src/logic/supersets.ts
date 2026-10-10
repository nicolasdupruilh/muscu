// Ordre des séries d'une séance, supersets compris.
//
// Les exercices qui se suivent avec la même valeur « superset » forment un groupe : série 1 de chaque exercice
// du groupe, puis le repos, puis la série 2, etc. Un exercice seul est un groupe d'un exercice.
// Le circuit abdos est un seul groupe qui contient tous les exercices (un tour = une série de chacun).

import type { PlannedExercise } from '../db/models'

export interface NextSet {
  key: string
  /** Numéro de la série (le « tour » pour un superset). */
  round: number
  /** Groupe du superset, s'il y en a un. */
  superset?: string
}

/** Groupes consécutifs de la séance : un exercice seul, ou les exercices d'un même superset qui se suivent. */
export function groupsOf(plan: PlannedExercise[]): PlannedExercise[][] {
  const groups: PlannedExercise[][] = []
  for (const p of plan) {
    const last = groups[groups.length - 1]
    if (p.superset && last && last[0].superset === p.superset) last.push(p)
    else groups.push([p])
  }
  return groups
}

/** Le groupe auquel appartient un exercice. */
export const groupOf = (plan: PlannedExercise[], key: string) => groupsOf(plan).find((g) => g.some((p) => p.key === key)) ?? []

/** Prochaine série à faire, dans l'ordre de la séance et des supersets. Les exercices sautés sont ignorés. */
export function nextSet(plan: PlannedExercise[], doneCount: (key: string) => number): NextSet | undefined {
  for (const group of groupsOf(plan)) {
    const active = group.filter((p) => !p.skipped)
    const rounds = Math.max(0, ...active.map((p) => p.sets))
    for (let round = 1; round <= rounds; round++) {
      // Un exercice qui a moins de séries que les autres sort du tour une fois fini.
      for (const p of active) if (p.sets >= round && doneCount(p.key) < round) return { key: p.key, round, superset: p.superset }
    }
  }
  return undefined
}

/** Nombre de tours d'un groupe (le plus grand nombre de séries de ses exercices). */
export const groupRounds = (group: PlannedExercise[]) => Math.max(0, ...group.filter((p) => !p.skipped).map((p) => p.sets))

/**
 * Repos à lancer après avoir validé une série de `key` :
 * - aucun si la série suivante est dans le même tour du même superset (on enchaîne sans pause) ;
 * - aucun si la séance est finie ;
 * - sinon le repos de l'exercice, ou pour un superset le plus long des repos de ses exercices.
 * `doneCount` compte les séries faites AVANT celle qu'on valide.
 */
export function restAfter(plan: PlannedExercise[], doneCount: (key: string) => number, key: string): number | undefined {
  const after = (k: string) => doneCount(k) + (k === key ? 1 : 0)
  const following = nextSet(plan, after)
  if (!following) return undefined
  const group = groupOf(plan, key)
  const round = doneCount(key) + 1
  if (group.length > 1 && group.some((p) => p.key === following.key) && following.round === round) return undefined
  const rest = Math.max(0, ...group.filter((p) => !p.skipped || p.key === key).map((p) => p.restSec))
  return rest > 0 ? rest : undefined
}

/** Plan d'une séance pour l'enchaînement : une séance abdos est toujours un circuit (même enregistrée avant les supersets). */
export const sequencedPlan = (plan: PlannedExercise[], type: string): PlannedExercise[] =>
  type === 'abdos' ? plan.map((p) => (p.superset ? p : { ...p, superset: 'circuit' })) : plan
