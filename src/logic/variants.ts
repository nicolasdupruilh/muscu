// Variantes par durée : choisir la séance qui tient dans le temps disponible, et corriger les durées estimées
// d'après les durées réelles de mes dernières séances.

import type { Variant } from '../data/types'
import type { Session } from '../db/models'

/** Durée estimée corrigée par le coefficient, en minutes entières. */
export const correctedMin = (v: Variant, factor = 1) => Math.round(v.estimatedMin * factor)

/**
 * Variante proposée pour le temps disponible (en minutes, null = sans limite) : la plus complète
 * dont la durée corrigée tient dans ce temps, sinon la plus courte. Les variantes vont de la plus courte à la complète.
 */
export function chooseVariant<V extends Variant>(variants: V[], availableMin: number | null, factor = 1): V {
  if (availableMin === null) return variants[variants.length - 1]
  const fitting = variants.filter((v) => correctedMin(v, factor) <= availableMin)
  return fitting.length ? fitting[fitting.length - 1] : variants[0]
}

export interface DurationSample {
  /** Fin de la séance, ISO. */
  endedAt: string
  estimatedMin: number
  realMin: number
}

export const DURATION_SAMPLES = 8

export interface DurationFactor {
  factor: number
  /** Nombre de séances retenues pour le calcul. */
  count: number
}

/**
 * Coefficient de correction des durées estimées : médiane de « réel ÷ estimé » sur mes 8 dernières séances
 * (après une éventuelle remise à 1), en écartant les séances aberrantes (moins de la moitié ou plus du double
 * de l'estimation : séance interrompue, ou oubliée ouverte). 1 s'il n'y a aucune séance utilisable.
 */
export function durationFactor(samples: DurationSample[], since?: string): DurationFactor {
  const ratios = samples
    .filter((s) => (!since || s.endedAt > since) && s.estimatedMin > 0)
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
    .map((s) => s.realMin / s.estimatedMin)
    .filter((r) => r >= 0.5 && r <= 2)
    .slice(0, DURATION_SAMPLES)
    .sort((a, b) => a - b)
  if (ratios.length === 0) return { factor: 1, count: 0 }
  const mid = Math.floor(ratios.length / 2)
  const median = ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2
  return { factor: Math.round(median * 100) / 100, count: ratios.length }
}

/** « ta dernière séance », « tes 5 dernières séances ». */
export const lastSessionsLabel = (count: number) => (count > 1 ? `tes ${count} dernières séances` : 'ta dernière séance')

/** 65 → « 1 h 05 », 45 → « 45 min », 120 → « 2 h ». */
export function formatDuration(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} h ${String(rest).padStart(2, '0')}` : `${h} h`
}

/** Choix rapides de l'écran « Combien de temps tu as ? » (null = sans limite). */
export const TIME_CHOICES: { label: string; min: number | null }[] = [
  { label: '45 min', min: 45 },
  { label: '1 h', min: 60 },
  { label: '1 h 30', min: 90 },
  { label: '2 h', min: 120 },
  { label: 'Sans limite', min: null },
]

/**
 * Durée réelle d'une séance, en minutes. Pour un push ou un pull, jusqu'à la fin des abdos enchaînés
 * (ils sont comptés dans la durée estimée de la variante).
 */
export function realDurationMin(session: Session, sessions: Session[]): number | undefined {
  if (session.status !== 'terminee' || !session.endedAt) return undefined
  const abs = sessions.find((s) => s.parentSessionId === session.id && s.status === 'terminee' && s.endedAt)
  const end = abs?.endedAt && abs.endedAt > session.endedAt ? abs.endedAt : session.endedAt
  return (new Date(end).getTime() - new Date(session.date).getTime()) / 60000
}

/** Séances terminées faites avec une variante : durée estimée et durée réelle. */
export function durationSamples(sessions: Session[]): DurationSample[] {
  return sessions.flatMap((s) => {
    const realMin = s.variant ? realDurationMin(s, sessions) : undefined
    return s.variant && realMin !== undefined ? [{ endedAt: s.endedAt!, estimatedMin: s.variant.estimatedMin, realMin }] : []
  })
}
