// Actions sur les séances en cours : démarrer, enregistrer une série, modifier le plan, terminer.
import { absBlockForWeek, absProgram, legPrescription, legProgram, legWeek, programShapes, upperTemplate } from '../data'
import type { LoadUnit, Variant } from '../data/types'
import { kneeRule, lastKneeSession } from '../logic/knee'
import { positionOf } from '../logic/programs'
import { restTaken } from '../logic/rest'
import { buildAbsPlan, buildLegPlan, replacePlanned } from '../logic/structuredPlans'
import { buildUpperPlan, slugify } from '../logic/upperPlan'
import { db, type AppDB } from './db'
import type { Exercise, PlannedExercise, Session, SessionVariant, SetLog } from './models'

export async function activeSession(database: AppDB = db): Promise<Session | undefined> {
  return database.sessions.where('status').equals('en-cours').first()
}

/** Variante d'une liste par son identifiant ; à défaut, la complète (la dernière). */
const variantById = <V extends { id: string }>(variants: V[], id?: string): V => variants.find((v) => v.id === id) ?? variants[variants.length - 1]

const sessionVariant = (v: Variant & { abdosRounds?: number }): SessionVariant => ({
  id: v.id,
  label: v.label,
  estimatedMin: v.estimatedMin,
  ...(v.abdosRounds !== undefined && { abdosRounds: v.abdosRounds }),
})

/** Démarre une séance push ou pull dans la variante choisie, ou renvoie la séance déjà en cours. */
export async function startUpperSession(type: 'push' | 'pull', variantId?: string, database: AppDB = db): Promise<number> {
  return database.transaction('rw', database.sessions, database.setLogs, database.exercises, async () => {
    const current = await activeSession(database)
    if (current) return current.id!
    const template = upperTemplate(type)
    const variant = variantById(template.variants, variantId)
    const exercises = new Map((await database.exercises.toArray()).map((e) => [e.id, e]))
    const available = (id: string) => !!exercises.get(id) && !exercises.get(id)!.archived
    const alternativeFor = (slot: string) => [...exercises.values()].find((e) => !e.archived && e.slots.includes(slot))?.id
    const plan = buildUpperPlan(template, variant, await database.setLogs.toArray(), available, alternativeFor)
    return (await database.sessions.add({
      date: new Date().toISOString(),
      type,
      status: 'en-cours',
      plan,
      variant: sessionVariant(variant),
    })) as number
  })
}

/**
 * Démarre la séance jambes à cette position du programme, dans la variante choisie (ou renvoie la séance en cours).
 * Le dernier check genou orange ou rouge ajuste la séance.
 */
export async function startLegSession(index: number, variantId?: string, database: AppDB = db): Promise<number> {
  return database.transaction('rw', database.sessions, database.exercises, async () => {
    const current = await activeSession(database)
    if (current) return current.id!
    const pos = positionOf(programShapes.jambes, index)
    const session = legWeek(pos.week)?.sessions[pos.label]
    if (!session) throw new Error(`Séance jambes introuvable : semaine ${pos.week} ${pos.label}`)
    const variant = variantById(session.variants, variantId)
    const previous = legWeek(pos.week - 1)?.sessions[pos.label]
    const level = kneeRule(lastKneeSession(await database.sessions.toArray())?.kneeCheck, legProgram.healthCheck.rules)?.level
    const kneeAdjustment = level === 'orange' || level === 'rouge' ? level : undefined
    const jumps = new Set((await database.exercises.where('category').equals('plyo').primaryKeys()) as string[])
    const plan = buildLegPlan(variant.items, previous && variantById(previous.variants, variant.id).items, kneeAdjustment, (id) => jumps.has(id))
    return (await database.sessions.add({
      date: new Date().toISOString(),
      type: 'jambes',
      status: 'en-cours',
      program: { programId: 'jambes', index },
      prescription: legPrescription(index),
      variant: sessionVariant(variant),
      plan,
      kneeAdjustment,
    })) as number
  })
}

/**
 * Démarre la séance abdos à cette position du programme. Enchaînée après un push ou un pull,
 * elle prend le nombre de tours de la variante de cette séance (abdosRounds).
 */
export async function startAbsSession(index: number, parentSessionId?: number, database: AppDB = db): Promise<number> {
  return database.transaction('rw', database.sessions, async () => {
    const current = await activeSession(database)
    if (current) return current.id!
    const block = absBlockForWeek(positionOf(programShapes.abdos, index).week)
    if (!block) throw new Error('Bloc abdos introuvable')
    const parent = parentSessionId !== undefined ? await database.sessions.get(parentSessionId) : undefined
    return (await database.sessions.add({
      date: new Date().toISOString(),
      type: 'abdos',
      status: 'en-cours',
      program: { programId: 'abdos', index },
      parentSessionId,
      plan: buildAbsPlan(block, absProgram.restBetweenRoundsSec, parent?.variant?.abdosRounds),
    })) as number
  })
}

/** Termine une séance jambes avec la douleur au genou pendant la séance (0 à 10). */
export async function finishLegSession(sessionId: number, pendant: number, database: AppDB = db) {
  await database.sessions.update(sessionId, {
    status: 'terminee',
    endedAt: new Date().toISOString(),
    rest: undefined,
    kneeCheck: { pendant },
  })
}

/** Réponse du lendemain matin : squat unipodal lent (0 à 10). */
export async function saveKneeNextDay(sessionId: number, lendemain: number, database: AppDB = db) {
  await database.transaction('rw', database.sessions, async () => {
    const s = await database.sessions.get(sessionId)
    if (s) await database.sessions.update(sessionId, { kneeCheck: { ...s.kneeCheck, lendemain, lendemainAt: new Date().toISOString() } })
  })
}

export async function updatePlan(sessionId: number, update: (plan: PlannedExercise[]) => PlannedExercise[], database: AppDB = db) {
  await database.transaction('rw', database.sessions, async () => {
    const s = await database.sessions.get(sessionId)
    if (s) await database.sessions.update(sessionId, { plan: update(s.plan ?? []) })
  })
}

/**
 * Enregistre une série validée : le repos réellement pris avant elle est mesuré sur le chrono de la séance.
 * Si `restSec` est donné, le chrono de repos suivant démarre. Renvoie l'id de la série.
 */
export async function logSet(
  set: Omit<SetLog, 'id' | 'at' | 'done' | 'restTakenSec'>,
  restSec?: number,
  database: AppDB = db,
): Promise<number> {
  return database.transaction('rw', database.sessions, database.setLogs, async () => {
    const now = Date.now()
    const at = new Date(now).toISOString()
    const session = await database.sessions.get(set.sessionId)
    const id = (await database.setLogs.add({ ...set, restTakenSec: restTaken(session?.rest, now), done: true, at })) as number
    await database.sessions.update(set.sessionId, {
      rest: restSec ? { planKey: set.planKey, startedAt: at, endsAt: new Date(now + restSec * 1000).toISOString() } : undefined,
    })
    return id
  })
}

/** Ajoute ou retire du temps au chrono de repos en cours (sans descendre sous maintenant). */
export async function adjustRest(sessionId: number, deltaSec: number, database: AppDB = db) {
  await database.transaction('rw', database.sessions, async () => {
    const s = await database.sessions.get(sessionId)
    if (!s?.rest) return
    const ends = Math.max(Date.now(), new Date(s.rest.endsAt).getTime() + deltaSec * 1000)
    await database.sessions.update(sessionId, { rest: { ...s.rest, endsAt: new Date(ends).toISOString() } })
  })
}

/** Fin du repos (« Passer » ou « C'est parti ») : le repos réellement pris s'arrête ici. */
export async function endRest(sessionId: number, database: AppDB = db) {
  await database.transaction('rw', database.sessions, async () => {
    const s = await database.sessions.get(sessionId)
    if (s?.rest && !s.rest.endedAt) await database.sessions.update(sessionId, { rest: { ...s.rest, endedAt: new Date().toISOString() } })
  })
}

export async function updateSet(id: number, changes: Partial<Pick<SetLog, 'loadKg' | 'reps' | 'durationSec'>>, database: AppDB = db) {
  await database.setLogs.update(id, changes)
}

/** Supprime une série et renumérote les suivantes du même exercice. */
export async function deleteSet(id: number, database: AppDB = db) {
  await database.transaction('rw', database.setLogs, async () => {
    const s = await database.setLogs.get(id)
    if (!s) return
    await database.setLogs.delete(id)
    const after = (await database.setLogs.where('sessionId').equals(s.sessionId).toArray()).filter(
      (l) => l.planKey === s.planKey && l.setNumber > s.setNumber,
    )
    for (const l of after) await database.setLogs.update(l.id!, { setNumber: l.setNumber - 1 })
  })
}

export async function finishSession(sessionId: number, database: AppDB = db) {
  await database.sessions.update(sessionId, { status: 'terminee', endedAt: new Date().toISOString(), rest: undefined })
}

/** Abandonne une séance en cours : la séance et ses séries sont supprimées. */
export async function abandonSession(sessionId: number, database: AppDB = db) {
  await database.transaction('rw', database.sessions, database.setLogs, async () => {
    await database.setLogs.where('sessionId').equals(sessionId).delete()
    await database.sessions.delete(sessionId)
  })
}

export interface NewExercise {
  name: string
  loadUnit: LoadUnit
  loadIncrementKg?: number
  unilateral: boolean
  defaultRestSec: number
  slots: string[]
  cues?: string
}

/** Ajoute un exercice créé par moi au catalogue et renvoie son id. */
export async function createExercise(input: NewExercise, database: AppDB = db): Promise<string> {
  return database.transaction('rw', database.exercises, async () => {
    const ids = new Set(await database.exercises.toCollection().primaryKeys())
    const withLoad = input.loadUnit === 'kg' || input.loadUnit === 'bodyweight+kg'
    const exercise: Exercise = {
      id: slugify(input.name, (id) => ids.has(id)),
      name: input.name.trim(),
      category: 'perso',
      equipment: '',
      loadUnit: input.loadUnit,
      unilateral: input.unilateral,
      defaultRestSec: input.defaultRestSec,
      slots: input.slots,
      cues: input.cues?.trim() ?? '',
      ...(withLoad ? { loadIncrementKg: input.loadIncrementKg ?? 2.5 } : {}),
      source: 'user',
      userModified: false,
      archived: false,
    }
    await database.exercises.add(exercise)
    return exercise.id
  })
}

/**
 * Remplace l'exercice prévu à cette place (séance cadrée) : la séance garde ce que le programme prévoyait
 * (« replaced ») et ce que je fais vraiment. La charge cible du programme ne vaut que pour l'exercice prévu ;
 * revenir à l'exercice prévu la rétablit.
 */
export async function replaceExercise(sessionId: number, key: string, exerciseId: string, database: AppDB = db) {
  const units = new Map((await database.exercises.toArray()).map((e) => [e.id, e.loadUnit]))
  await updatePlan(sessionId, (plan) => plan.map((p) => (p.key === key ? replacePlanned(p, exerciseId, (id) => units.get(id)) : p)), database)
}

/** Alternatives proposées pour remplacer un exercice : celles du catalogue, et les exercices qui le citent en alternative. */
export function alternativesFor(exerciseId: string, exercises: Exercise[]): string[] {
  const own = exercises.find((e) => e.id === exerciseId)?.alternatives ?? []
  const reverse = exercises.filter((e) => e.alternatives?.includes(exerciseId)).map((e) => e.id)
  const byId = new Map(exercises.map((e) => [e.id, e]))
  return [...new Set([...own, ...reverse])].filter((id) => id !== exerciseId && byId.has(id) && !byId.get(id)!.archived)
}
