import type { UpperTemplate, UpperVariant } from '../data/types'
import type { PlannedExercise, SetLog } from '../db/models'
import { lastExerciseAt } from './history'
import { lastChosenRest } from './rest'

/**
 * Repère d'une place de la trame, indépendant de la variante : « push:triceps:2 » = 2e place triceps du push.
 * (Les positions changent d'une variante à l'autre ; le slot et son rang, non.)
 */
export const placeKey = (templateId: string, slot: string, occurrence: number) => `${templateId}:${slot}:${occurrence}`

/**
 * Plan d'une séance push ou pull pour la variante choisie : la trame slot par slot, avec pour chaque place
 * l'exercice fait la dernière fois à cette place (sinon l'exercice par défaut de la trame),
 * et le repos choisi la dernière fois pour cet exercice (sinon celui du slot).
 * `isAvailable` écarte un exercice archivé ou supprimé ; si l'exercice par défaut l'est aussi,
 * `alternativeFor` propose un autre exercice disponible du même slot.
 */
export function buildUpperPlan(
  template: UpperTemplate,
  variant: UpperVariant,
  logs: SetLog[],
  isAvailable: (id: string) => boolean,
  alternativeFor: (slot: string) => string | undefined = () => undefined,
): PlannedExercise[] {
  const seen = new Map<string, number>()
  return variant.slots.map((s) => {
    const occurrence = (seen.get(s.slot) ?? 0) + 1
    seen.set(s.slot, occurrence)
    const templateKey = placeKey(template.id, s.slot, occurrence)
    const last = lastExerciseAt(logs, templateKey)
    const exerciseId =
      last && isAvailable(last) ? last : isAvailable(s.defaultExerciseId) ? s.defaultExerciseId : alternativeFor(s.slot) ?? s.defaultExerciseId
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
      superset: s.superset,
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
