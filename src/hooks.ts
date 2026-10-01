import { useLiveQuery } from 'dexie-react-hooks'
import { programShapes } from './data'
import { db, getSettings } from './db/db'
import type { ProgramId } from './db/models'
import { completionsOf } from './db/queries'
import { programStatus } from './logic/programs'

export const useSessions = () => useLiveQuery(() => db.sessions.orderBy('date').toArray(), [])

export const useSettings = () => useLiveQuery(() => getSettings(), [])

/** État d'un programme cadré, ou undefined pendant le chargement. */
export function useProgramStatus(id: ProgramId) {
  const sessions = useSessions()
  const settings = useSettings()
  if (!sessions || !settings) return undefined
  return programStatus(programShapes[id], completionsOf(sessions, id), settings.programs[id])
}

/** Exercices de la base, indexés par id. */
export const useExercises = () =>
  useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), [])

/** Séance en cours (null s'il n'y en a pas, undefined pendant le chargement). */
export const useActiveSession = () =>
  useLiveQuery(async () => (await db.sessions.where('status').equals('en-cours').first()) ?? null, [])

export const useSetLogs = () => useLiveQuery(() => db.setLogs.toArray(), [])
