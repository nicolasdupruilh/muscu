import type { UpperTemplate } from '../data/types'
import type { PlannedExercise, SetLog } from '../db/models'
import { lastExerciseAt } from './history'
import { lastChosenRest } from './rest'

/**
 * Plan d'une séance push ou pull : la trame slot par slot, avec pour chaque place
 * l'exercice fait la dernière fois à cette place (sinon l'exercice par défaut de la trame),
 * et le repos choisi la dernière fois pour cet exercice (sinon celui du slot).
 * `isAvailable` écarte un exercice archivé ou supprimé.
 */
export function buildUpperPlan(template: UpperTemplate, logs: SetLog[], isAvailable: (id: string) => boolean): PlannedExercise[] {
  return template.slots.map((s, i) => {
    const templateKey = `${template.id}:${i}`
    const last = lastExerciseAt(logs, templateKey)
    const exerciseId = last && isAvailable(last) ? last : s.defaultExerciseId
    return {
      key: templateKey,
      templateKey,
      slot: s.slot,
      label: s.label,
      exerciseId,
      sets: s.sets,
      repRange: s.repRange,
      restSec: lastChosenRest(logs, exerciseId) ?? s.restSec,
      note: s.note || undefined,
    }
  })
}

/** Identifiant lisible et unique à partir d'un nom : « Curl araignée » → « curl-araignee ». */
export function slugify(name: string, taken: (id: string) => boolean): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'exercice'
  let id = base
  for (let n = 2; taken(id); n++) id = `${base}-${n}`
  return id
}
