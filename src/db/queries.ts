import type { Completion } from '../logic/programs'
import { db, type AppDB } from './db'
import type { ProgramId, Session } from './models'

/** Séances cadrées terminées d'un programme, pour calculer la progression. */
export function completionsOf(sessions: Session[], programId: ProgramId): Completion[] {
  return sessions
    .filter((s) => s.status === 'terminee' && s.program?.programId === programId)
    .map((s) => ({ index: s.program!.index, at: s.endedAt ?? s.date }))
}

/** Enregistre un footing fait maintenant. */
export async function logFooting(database: AppDB = db): Promise<number> {
  const now = new Date().toISOString()
  return (await database.sessions.add({ date: now, endedAt: now, type: 'course', status: 'terminee' })) as number
}
