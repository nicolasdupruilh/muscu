// Lecture des reps prescrites dans les programmes : 6, "8/côté", "8/jambe", "6-8", "20 s", "25 s/côté", "10 min", "15 m".

import type { LoadUnit, Reps } from '../data/types'

export interface ParsedReps {
  kind: 'reps' | 'time' | 'distance' | 'text'
  /** Reps, secondes ou mètres ; bas de la fourchette pour « 6-8 ». */
  value?: number
  /** Haut de la fourchette pour « 6-8 ». */
  max?: number
  perSide: boolean
  /** Mot employé pour « par côté » : « côté » ou « jambe ». */
  side?: 'côté' | 'jambe'
  /** Texte d'origine. */
  text: string
}

export function parseReps(reps: Reps): ParsedReps {
  if (typeof reps === 'number') return { kind: 'reps', value: reps, perSide: false, text: String(reps) }
  const text = reps.trim()
  const sideMatch = text.match(/\/\s*(c[ôo]t[ée]|jambe)/i)
  const side = sideMatch ? (sideMatch[1].toLowerCase() === 'jambe' ? 'jambe' : 'côté') : undefined
  const core = (sideMatch ? text.replace(sideMatch[0], '') : text).trim()
  const parsed = (p: Pick<ParsedReps, 'kind' | 'value' | 'max'>): ParsedReps => ({ ...p, perSide: !!side, ...(side && { side }), text })
  let m: RegExpMatchArray | null
  if ((m = core.match(/^(\d+)\s*-\s*(\d+)$/))) return parsed({ kind: 'reps', value: +m[1], max: +m[2] })
  if ((m = core.match(/^(\d+)$/))) return parsed({ kind: 'reps', value: +m[1] })
  if ((m = core.match(/^(\d+)\s*s$/))) return parsed({ kind: 'time', value: +m[1] })
  if ((m = core.match(/^(\d+)\s*min$/))) return parsed({ kind: 'time', value: +m[1] * 60 })
  if ((m = core.match(/^(\d+)\s*m$/))) return parsed({ kind: 'distance', value: +m[1] })
  return parsed({ kind: 'text' })
}

/** Prescription en clair : « 8 reps par côté », « 8 reps par jambe », « 6 à 8 reps », « 25 s par côté », « 10 min », « 15 m ». */
export function describeReps(p: ParsedReps): string {
  const side = p.perSide ? ` par ${p.side ?? 'côté'}` : ''
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
