// Recherches dans l'historique des séries. L'historique est rattaché à l'exercice, pas au slot.

import type { LoadUnit } from '../data/types'
import type { SetLog } from '../db/models'
import type { PastSet } from './doubleProgression'

export interface LastPerformance {
  sessionId: number
  /** Heure de la dernière série validée de cette séance. */
  at: string
  sets: SetLog[]
}

/** Dernière séance (autre que la séance en cours) où l'exercice a été fait, avec ses séries validées. */
export function lastPerformance(logs: SetLog[], exerciseId: string, excludeSessionId?: number): LastPerformance | undefined {
  const mine = logs.filter((l) => l.exerciseId === exerciseId && l.done && l.sessionId !== excludeSessionId)
  if (mine.length === 0) return undefined
  const latest = mine.reduce((a, b) => (b.at > a.at ? b : a))
  const sets = mine.filter((l) => l.sessionId === latest.sessionId).sort((a, b) => a.setNumber - b.setNumber)
  return { sessionId: latest.sessionId, at: sets.reduce((m, s) => (s.at > m ? s.at : m), ''), sets }
}

/** Exercice fait la dernière fois à cette place de la trame (« push:5 »…). */
export function lastExerciseAt(logs: SetLog[], templateKey: string): string | undefined {
  let best: SetLog | undefined
  for (const l of logs) if (l.templateKey === templateKey && l.done && (!best || l.at > best.at)) best = l
  return best?.exerciseId
}

/** Valeur réalisée d'une série : secondes pour un exercice en durée, reps sinon. */
export const setValue = (s: Pick<SetLog, 'reps' | 'durationSec'>, unit: LoadUnit) =>
  (unit === 'time' ? s.durationSec : s.reps) ?? 0

export const hasLoad = (unit: LoadUnit) => unit === 'kg' || unit === 'bodyweight+kg'

export const toPastSets = (sets: SetLog[], unit: LoadUnit): PastSet[] =>
  sets.map((s) => ({ loadKg: hasLoad(unit) ? s.loadKg ?? 0 : undefined, value: setValue(s, unit) }))
