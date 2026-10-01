// Sauvegarde manuelle : toutes les données dans un fichier JSON, et restauration depuis ce fichier.
import { toLocalDate } from '../logic/dates'
import { db, syncCatalogue, type AppDB } from './db'
import type { Exercise, Session, SetLog, Settings } from './models'

export const BACKUP_APP = 'appli-sport'
export const BACKUP_FORMAT = 1

export interface Backup {
  app: typeof BACKUP_APP
  format: number
  exportedAt: string
  data: {
    exercises: Exercise[]
    sessions: Session[]
    setLogs: SetLog[]
    settings: Settings[]
  }
}

export async function exportBackup(database: AppDB = db): Promise<Backup> {
  return database.transaction('r', database.exercises, database.sessions, database.setLogs, database.settings, async () => ({
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    data: {
      exercises: await database.exercises.toArray(),
      sessions: await database.sessions.toArray(),
      setLogs: await database.setLogs.toArray(),
      settings: await database.settings.toArray(),
    },
  }))
}

export const backupFileName = (d = new Date()) => `muscu-sauvegarde-${toLocalDate(d)}.json`

/** Vérifie qu'un fichier est bien une sauvegarde de l'appli. Renvoie la liste des problèmes (vide si tout va bien). */
export function checkBackup(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return ['Ce fichier ne contient pas de données JSON lisibles.']
  const b = value as Partial<Backup>
  if (b.app !== BACKUP_APP) return ['Ce fichier n’est pas une sauvegarde de cette appli.']
  if (typeof b.format !== 'number' || b.format > BACKUP_FORMAT) return ['Sauvegarde faite par une version plus récente de l’appli.']
  const d = b.data
  if (!d) return ['Sauvegarde vide.']
  const errors: string[] = []
  for (const key of ['exercises', 'sessions', 'setLogs', 'settings'] as const) {
    if (!Array.isArray(d[key])) errors.push(`Partie « ${key} » absente ou illisible.`)
  }
  if (errors.length) return errors
  if (d.exercises.some((e) => typeof e?.id !== 'string')) errors.push('Un exercice n’a pas d’identifiant.')
  if (d.sessions.some((s) => typeof s?.id !== 'number' || typeof s.date !== 'string')) errors.push('Une séance est incomplète.')
  const sessionIds = new Set(d.sessions.map((s) => s.id))
  if (d.setLogs.some((l) => !sessionIds.has(l?.sessionId))) errors.push('Des séries ne sont rattachées à aucune séance.')
  return errors
}

export interface BackupStats {
  sessions: number
  sets: number
  userExercises: number
}

export const backupStats = (b: Backup): BackupStats => ({
  sessions: b.data.sessions.filter((s) => s.status === 'terminee').length,
  sets: b.data.setLogs.length,
  userExercises: b.data.exercises.filter((e) => e.source === 'user').length,
})

/** Remplace toutes les données par celles de la sauvegarde, puis complète le catalogue si besoin. */
export async function importBackup(b: Backup, database: AppDB = db): Promise<void> {
  const errors = checkBackup(b)
  if (errors.length) throw new Error(errors.join(' '))
  await database.transaction('rw', database.exercises, database.sessions, database.setLogs, database.settings, async () => {
    await Promise.all([database.exercises.clear(), database.sessions.clear(), database.setLogs.clear(), database.settings.clear()])
    await database.exercises.bulkAdd(b.data.exercises)
    await database.sessions.bulkAdd(b.data.sessions)
    await database.setLogs.bulkAdd(b.data.setLogs)
    await database.settings.bulkAdd(b.data.settings)
  })
  await syncCatalogue(database)
}
