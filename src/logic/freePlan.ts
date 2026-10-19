// Séance push ou pull libre : pas de trame imposée, je choisis l'exercice suivant à la fin du précédent.
//
// La trame du fichier sert seulement à deux choses : savoir quels exercices sont « du jour » (leurs slots
// figurent dans la trame push ou pull) et donner séries, fourchette de reps et repos par défaut à un exercice
// que je n'ai jamais fait en séance libre.

import type { TemplateSlot, UpperTemplate } from '../data/types'
import type { Exercise, PlannedExercise, Session, SetLog } from '../db/models'
import { lastChosenRest } from './rest'

/** Slots de la trame, toutes variantes confondues (la plus complète d'abord pour les valeurs par défaut). */
function templateSlots(template: UpperTemplate): TemplateSlot[] {
  const seen = new Map<string, TemplateSlot>()
  for (const v of [...template.variants].reverse()) for (const s of v.slots) if (!seen.has(s.slot)) seen.set(s.slot, s)
  return [...seen.values()]
}

/**
 * Exercices du jour, non archivés : ceux dont un slot appartient à la trame push (ou pull),
 * et ceux que j'ai déjà faits dans une séance de ce type (un exercice créé sur place y revient ensuite).
 */
export function dayExerciseIds(template: UpperTemplate, exercises: Exercise[], sessions: Session[], logs: SetLog[]): string[] {
  const slots = new Set(templateSlots(template).map((s) => s.slot))
  const sameType = new Set(sessions.filter((s) => s.type === template.id).map((s) => s.id))
  const done = new Set(logs.filter((l) => l.done && sameType.has(l.sessionId)).map((l) => l.exerciseId))
  return exercises.filter((e) => !e.archived && (done.has(e.id) || e.slots.some((s) => slots.has(s)))).map((e) => e.id)
}

/**
 * Place à ajouter dans une séance libre pour cet exercice. Séries, fourchette de reps et repos :
 * - ceux de la dernière séance où je l'ai fait (séries réellement faites) ;
 * - sinon ceux de sa place dans la trame (push ou pull, puis l'autre) ;
 * - sinon 3 séries de 8 à 12 reps (20 à 40 s pour un exercice en durée) et son repos par défaut.
 */
export function freePlanned(
  exercise: Exercise,
  templates: UpperTemplate[],
  sessions: Session[],
  logs: SetLog[],
  key: string,
): PlannedExercise {
  const lastLogs = logs.filter((l) => l.exerciseId === exercise.id && l.done)
  const lastSessionId = lastLogs.reduce<SetLog | undefined>((m, l) => (!m || l.at > m.at ? l : m), undefined)?.sessionId
  // Une place prescrite (séance jambes) ne donne pas de fourchette de reps à reprendre.
  const lastPlanned = sessions.find((s) => s.id === lastSessionId)?.plan?.find((p) => p.exerciseId === exercise.id && p.prescribedReps === undefined)
  const doneLast = lastLogs.filter((l) => l.sessionId === lastSessionId).length
  const slot = templates.flatMap(templateSlots).find((s) => exercise.slots.includes(s.slot))
  const repRange: [number, number] = lastPlanned?.repRange ?? slot?.repRange ?? (exercise.loadUnit === 'time' ? [20, 40] : [8, 12])
  return {
    key,
    exerciseId: exercise.id,
    slot: slot?.slot,
    sets: doneLast || slot?.sets || 3,
    repRange,
    restSec: lastChosenRest(logs, exercise.id) ?? slot?.restSec ?? (exercise.defaultRestSec || 90),
  }
}

/** Ajoute un exercice seul, ou deux en superset (ils s'enchaînent sans pause, repos après le second). */
export function addToFreePlan(plan: PlannedExercise[], items: PlannedExercise[]): PlannedExercise[] {
  if (items.length < 2) return [...plan, ...items]
  const taken = new Set(plan.map((p) => p.superset))
  let n = 1
  while (taken.has(`S${n}`)) n++
  return [...plan, ...items.map((p) => ({ ...p, superset: `S${n}` }))]
}
