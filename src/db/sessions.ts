// Actions sur les séances en cours : démarrer, enregistrer une série, modifier le plan, terminer.
import { upperBody } from '../data'
import type { LoadUnit } from '../data/types'
import { buildUpperPlan, slugify } from '../logic/upperPlan'
import { db, type AppDB } from './db'
import type { Exercise, PlannedExercise, Session, SetLog } from './models'

export async function activeSession(database: AppDB = db): Promise<Session | undefined> {
  return database.sessions.where('status').equals('en-cours').first()
}

/** Démarre une séance push ou pull, ou renvoie la séance déjà en cours. */
export async function startUpperSession(type: 'push' | 'pull', database: AppDB = db): Promise<number> {
  return database.transaction('rw', database.sessions, database.setLogs, database.exercises, async () => {
    const current = await activeSession(database)
    if (current) return current.id!
    const template = upperBody.templates.find((t) => t.id === type)!
    const exercises = new Map((await database.exercises.toArray()).map((e) => [e.id, e]))
    const available = (id: string) => !!exercises.get(id) && !exercises.get(id)!.archived
    const plan = buildUpperPlan(template, await database.setLogs.toArray(), available)
    return (await database.sessions.add({ date: new Date().toISOString(), type, status: 'en-cours', plan })) as number
  })
}

export async function updatePlan(sessionId: number, update: (plan: PlannedExercise[]) => PlannedExercise[], database: AppDB = db) {
  await database.transaction('rw', database.sessions, async () => {
    const s = await database.sessions.get(sessionId)
    if (s) await database.sessions.update(sessionId, { plan: update(s.plan ?? []) })
  })
}

/** Enregistre une série validée et renvoie son id. */
export async function logSet(set: Omit<SetLog, 'id' | 'at' | 'done'>, database: AppDB = db): Promise<number> {
  return (await database.setLogs.add({ ...set, done: true, at: new Date().toISOString() })) as number
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
  await database.sessions.update(sessionId, { status: 'terminee', endedAt: new Date().toISOString() })
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
      cues: '',
      ...(withLoad ? { loadIncrementKg: input.loadIncrementKg ?? 2.5 } : {}),
      source: 'user',
      userModified: false,
      archived: false,
    }
    await database.exercises.add(exercise)
    return exercise.id
  })
}
