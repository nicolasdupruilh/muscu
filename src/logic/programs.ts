// Progression dans les programmes cadrés (jambes, abdos).
//
// Un programme est une suite de séances : semaine 1 séance A, semaine 1 séance B, semaine 2 séance A…
// Chaque séance a un rang (index). On n'avance pas selon le calendrier mais selon les séances faites :
// une séance pas faite reste à faire, elle est décalée, jamais sautée.
// Une correction manuelle (« je reprends à la semaine 5 séance A ») fixe un nouveau point de départ.

import type { ProgramSettings } from '../db/models'

export interface ProgramShape {
  weeksCount: number
  /** Libellés des séances d'une semaine, dans l'ordre : ['A', 'B'] pour les jambes. */
  sessionLabels: string[]
}

export interface Position {
  index: number
  /** Semaine, à partir de 1. */
  week: number
  /** Rang de la séance dans la semaine, à partir de 0. */
  slot: number
  label: string
}

/** Une séance cadrée terminée : son rang dans le programme et sa date. */
export interface Completion {
  index: number
  at: string
}

export const programLength = (p: ProgramShape) => p.weeksCount * p.sessionLabels.length

export function toIndex(p: ProgramShape, week: number, slot: number): number {
  return (week - 1) * p.sessionLabels.length + slot
}

export function positionOf(p: ProgramShape, index: number): Position {
  const n = p.sessionLabels.length
  const slot = index % n
  return { index, week: Math.floor(index / n) + 1, slot, label: p.sessionLabels[slot] }
}

/** Séances qui comptent : celles faites après la dernière correction manuelle. */
export function countedCompletions(completions: Completion[], settings: ProgramSettings): Completion[] {
  const since = settings.override?.at
  return since ? completions.filter((c) => c.at > since) : completions
}

/**
 * Rang de la prochaine séance à faire : la première séance non faite à partir du point de départ
 * (début du programme ou correction manuelle). Si une séance a été faite dans le désordre
 * (B avant A), celle qui manque reste proposée en premier.
 * Renvoie programLength(p) quand tout est fait.
 */
export function nextIndex(p: ProgramShape, completions: Completion[], settings: ProgramSettings): number {
  const start = settings.override?.index ?? 0
  const done = new Set(countedCompletions(completions, settings).map((c) => c.index))
  let i = start
  while (i < programLength(p) && done.has(i)) i++
  return i
}

export interface WeekSessionStatus {
  position: Position
  done: boolean
  /** Avant le point de départ d'une correction manuelle, sans avoir été faite. */
  skipped: boolean
  /** C'est la prochaine séance à faire. */
  next: boolean
}

export interface ProgramStatus {
  finished: boolean
  next?: Position
  /** Séances de la semaine de la prochaine séance, avec leur état. */
  week: WeekSessionStatus[]
}

export function programStatus(p: ProgramShape, completions: Completion[], settings: ProgramSettings): ProgramStatus {
  const idx = nextIndex(p, completions, settings)
  if (idx >= programLength(p)) return { finished: true, week: [] }
  const next = positionOf(p, idx)
  const start = settings.override?.index ?? 0
  const done = new Set(countedCompletions(completions, settings).map((c) => c.index))
  const week = p.sessionLabels.map((_, slot) => {
    const position = positionOf(p, toIndex(p, next.week, slot))
    const isDone = done.has(position.index)
    return { position, done: isDone, skipped: !isDone && position.index < start, next: position.index === idx }
  })
  return { finished: false, next, week }
}
