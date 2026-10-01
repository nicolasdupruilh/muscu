// Calculs de l'historique : meilleure série par séance, 1RM estimé, résumé d'une séance, courbe du genou.

import type { LoadUnit } from '../data/types'
import type { Session, SetLog } from '../db/models'

/** 1RM estimé (formule d'Epley), arrondi au demi-kilo. Au-delà de 12 reps l'estimation devient peu fiable. */
export function estimated1RM(loadKg: number, reps: number): number {
  const raw = reps <= 1 ? loadKg : loadKg * (1 + reps / 30)
  return Math.round(raw * 2) / 2
}

export interface Metric {
  id: string
  label: string
  /** Valeur d'une série pour cette mesure ; undefined si elle ne s'applique pas. */
  of: (s: SetLog) => number | undefined
  unit: string
}

/** Mesures proposées pour la courbe selon le type de charge de l'exercice. */
export function metricsFor(unit: LoadUnit): Metric[] {
  const reps: Metric = { id: 'reps', label: 'Reps max', of: (s) => s.reps, unit: 'reps' }
  switch (unit) {
    case 'kg':
      return [
        { id: '1rm', label: '1RM estimé', of: (s) => (s.loadKg !== undefined && s.reps ? estimated1RM(s.loadKg, s.reps) : undefined), unit: 'kg' },
        { id: 'charge', label: 'Charge max', of: (s) => (s.reps ? s.loadKg : undefined), unit: 'kg' },
        reps,
      ]
    case 'bodyweight+kg':
      return [{ id: 'lest', label: 'Lest max', of: (s) => (s.reps ? s.loadKg ?? 0 : undefined), unit: 'kg' }, reps]
    case 'time':
      return [{ id: 'duree', label: 'Durée max', of: (s) => s.durationSec, unit: 's' }]
    default:
      return [reps]
  }
}

export interface ExercisePoint {
  sessionId: number
  /** Date de la séance, ISO. */
  date: string
  value: number
  /** Série qui donne la valeur. */
  best: SetLog
  sets: SetLog[]
}

/** Une valeur par séance : la meilleure série selon la mesure. Séances terminées seulement, dans l'ordre chronologique. */
export function exerciseHistory(logs: SetLog[], sessions: Session[], exerciseId: string, metric: Metric): ExercisePoint[] {
  const done = new Map(sessions.filter((s) => s.status === 'terminee').map((s) => [s.id, s]))
  const bySession = new Map<number, SetLog[]>()
  for (const l of logs) {
    if (l.exerciseId !== exerciseId || !l.done || !done.has(l.sessionId)) continue
    bySession.set(l.sessionId, [...(bySession.get(l.sessionId) ?? []), l])
  }
  const points: ExercisePoint[] = []
  for (const [sessionId, sets] of bySession) {
    let best: SetLog | undefined
    let value = -Infinity
    for (const s of sets) {
      const v = metric.of(s)
      if (v !== undefined && v > value) [best, value] = [s, v]
    }
    if (best) points.push({ sessionId, date: done.get(sessionId)!.date, value, best, sets: sets.sort((a, b) => a.setNumber - b.setNumber) })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

export interface SessionSummary {
  exercises: number
  sets: number
  /** Durée en minutes, si la séance est terminée. */
  minutes?: number
}

export function sessionSummary(session: Session, logs: SetLog[]): SessionSummary {
  const mine = logs.filter((l) => l.sessionId === session.id && l.done)
  const end = session.endedAt ?? mine.reduce((m, l) => (l.at > m ? l.at : m), '')
  const minutes = end ? Math.round((new Date(end).getTime() - new Date(session.date).getTime()) / 60000) : undefined
  return { exercises: new Set(mine.map((l) => l.planKey)).size, sets: mine.length, minutes: minutes && minutes > 0 ? minutes : undefined }
}

export interface KneePoint {
  sessionId: number
  date: string
  pendant?: number
  lendemain?: number
}

/** Douleur au genou de chaque séance jambes, dans l'ordre chronologique. */
export function kneeHistory(sessions: Session[]): KneePoint[] {
  return sessions
    .filter((s) => s.type === 'jambes' && s.status === 'terminee' && s.kneeCheck)
    .map((s) => ({ sessionId: s.id!, date: s.date, pendant: s.kneeCheck!.pendant, lendemain: s.kneeCheck!.lendemain }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
