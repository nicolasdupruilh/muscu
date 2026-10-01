// Lecture des reps prescrites dans les programmes : 6, "8/côté", "6-8", "20 s", "25 s/côté", "10 min", "15 m".

import type { LoadUnit, Reps } from '../data/types'

export interface ParsedReps {
  kind: 'reps' | 'time' | 'distance' | 'text'
  /** Reps, secondes ou mètres ; bas de la fourchette pour « 6-8 ». */
  value?: number
  /** Haut de la fourchette pour « 6-8 ». */
  max?: number
  perSide: boolean
  /** Texte d'origine. */
  text: string
}

export function parseReps(reps: Reps): ParsedReps {
  if (typeof reps === 'number') return { kind: 'reps', value: reps, perSide: false, text: String(reps) }
  const text = reps.trim()
  const perSide = /\/\s*c[ôo]t[ée]/i.test(text)
  const core = text.replace(/\/\s*c[ôo]t[ée]/i, '').trim()
  let m: RegExpMatchArray | null
  if ((m = core.match(/^(\d+)\s*-\s*(\d+)$/))) return { kind: 'reps', value: +m[1], max: +m[2], perSide, text }
  if ((m = core.match(/^(\d+)$/))) return { kind: 'reps', value: +m[1], perSide, text }
  if ((m = core.match(/^(\d+)\s*s$/))) return { kind: 'time', value: +m[1], perSide, text }
  if ((m = core.match(/^(\d+)\s*min$/))) return { kind: 'time', value: +m[1] * 60, perSide, text }
  if ((m = core.match(/^(\d+)\s*m$/))) return { kind: 'distance', value: +m[1], perSide, text }
  return { kind: 'text', perSide, text }
}

/** Prescription en clair : « 8 reps par côté », « 6 à 8 reps », « 25 s par côté », « 10 min », « 15 m ». */
export function describeReps(p: ParsedReps): string {
  const side = p.perSide ? ' par côté' : ''
  if (p.kind === 'reps') return p.max !== undefined ? `${p.value} à ${p.max} reps${side}` : `${p.value} rep${p.value! > 1 ? 's' : ''}${side}`
  if (p.kind === 'time') return p.value! >= 120 && p.value! % 60 === 0 ? `${p.value! / 60} min${side}` : `${p.value} s${side}`
  if (p.kind === 'distance') return `${p.value} m${side}`
  return p.text
}

/**
 * Façon de saisir une série :
 * - « reps » : nombre de reps ;
 * - « time » : durée, pour un exercice en durée (gainage, front lever) ;
 * - « check » : série simplement cochée (échauffement de 10 min, traîneau sur 15 m…).
 */
export type EntryMode = 'reps' | 'time' | 'check'

export function entryMode(p: ParsedReps, unit: LoadUnit): EntryMode {
  if (p.kind === 'reps') return 'reps'
  if (p.kind === 'time' && unit === 'time') return 'time'
  return 'check'
}
