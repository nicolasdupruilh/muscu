// Repos entre les séries : temps choisi, ajustement de la cible si le repos est nettement plus court,
// et chrono calculé à partir de l'heure de fin (il reste juste si l'appli passe en arrière-plan).

import type { SetLog } from '../db/models'
import type { PastSet, Target } from './doubleProgression'
import { formatRest } from './format'

/** Choix rapides proposés avant un exercice. */
export const REST_PRESETS = [45, 60, 90, 120, 150, 180]

/** Ajustement fin du chrono et du repos choisi. */
export const REST_STEP = 15

/** Repos choisi la dernière fois pour cet exercice (hors séance en cours). */
export function lastChosenRest(logs: SetLog[], exerciseId: string, excludeSessionId?: number): number | undefined {
  let best: SetLog | undefined
  for (const l of logs) {
    if (l.exerciseId !== exerciseId || !l.done || l.sessionId === excludeSessionId || l.restPlannedSec === undefined) continue
    if (!best || l.at > best.at) best = l
  }
  return best?.restPlannedSec
}

/**
 * Repos de référence de la dernière fois : moyenne des repos réellement pris entre les séries
 * (la 1re série n'a pas de repos significatif), sinon le repos choisi.
 */
export function lastRestReference(lastSets: SetLog[]): number | undefined {
  const taken = lastSets.filter((s) => s.setNumber > 1 && s.restTakenSec !== undefined).map((s) => s.restTakenSec!)
  if (taken.length) return Math.round(taken.reduce((a, b) => a + b, 0) / taken.length)
  return lastSets.find((s) => s.restPlannedSec !== undefined)?.restPlannedSec
}

export interface RestAdjustment {
  /** Reps (ou secondes) à retirer par série. */
  reduceBy: number
  message: string
}

/** Repos au moins 30 % plus court que la dernière fois : viser 1 rep de moins (2 si le repos est divisé par 2 ou plus). */
export function restAdjustment(chosenSec: number, lastSec: number | undefined): RestAdjustment | undefined {
  if (!lastSec || chosenSec > lastSec * 0.7) return undefined
  const reduceBy = chosenSec <= lastSec * 0.5 ? 2 : 1
  return {
    reduceBy,
    message: `Repos plus court que la dernière fois (${formatRest(chosenSec)} au lieu de ${formatRest(lastSec)}) : vise ${reduceBy} rep${reduceBy > 1 ? 's' : ''} de moins, à la même charge.`,
  }
}

/** Cible ajustée : charge de la dernière fois, et reps de la dernière fois moins `reduceBy` (au moins 1). */
export function applyRestAdjustment(target: Target, last: PastSet[], adj: RestAdjustment): Target {
  if (last.length === 0) return target
  return {
    sets: target.sets.map((_, i) => {
      const ref = last[Math.min(i, last.length - 1)]
      return { loadKg: ref.loadKg, value: Math.max(1, ref.value - adj.reduceBy) }
    }),
    reason: adj.message,
    increased: false,
  }
}

/** Temps restant en millisecondes (négatif une fois le repos dépassé). */
export const remainingMs = (endsAt: string, now: number) => new Date(endsAt).getTime() - now

/** 90 000 ms → « 1:30 » ; dépassement de 12 s → « +0:12 ». */
export function formatClock(ms: number): string {
  const over = ms < 0
  const total = over ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${over ? '+' : ''}${m}:${String(s).padStart(2, '0')}`
}

/** Repos réellement pris : du début du repos jusqu'à sa fin déclarée (« Passer », « C'est parti »), sinon jusqu'à maintenant. */
export function restTaken(rest: { startedAt: string; endedAt?: string } | undefined, now: number): number | undefined {
  if (!rest) return undefined
  const end = rest.endedAt ? new Date(rest.endedAt).getTime() : now
  return Math.max(0, Math.round((end - new Date(rest.startedAt).getTime()) / 1000))
}
