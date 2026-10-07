import Dexie, { type EntityTable } from 'dexie'
import { catalogue, legPrescription } from '../data'
import type { CatalogueExercise } from '../data/types'
import { defaultSettings, type Exercise, type Session, type SetLog, type Settings } from './models'

export class AppDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  sessions!: EntityTable<Session, 'id'>
  setLogs!: EntityTable<SetLog, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor(name = 'appli-sport') {
    super(name)
    this.version(1).stores({
      exercises: 'id, category, *slots',
      sessions: '++id, date, type, [type+date]',
      setLogs: '++id, sessionId, exerciseId, [exerciseId+at]',
      settings: 'id',
    })
    this.version(2).stores({
      sessions: '++id, date, type, status, [type+date]',
      setLogs: '++id, sessionId, exerciseId, templateKey, [exerciseId+at]',
    })
    // Programme jambes v2 : les séances jambes déjà en base reçoivent une copie du prescrit (version 1).
    this.version(3).upgrade((tx) => tx.table('sessions').toCollection().modify(fillLegPrescription))
  }
}

/**
 * Complète une séance jambes enregistrée avant que la copie du prescrit existe : elle date du programme v1.
 * Son plan (exercices, séries, charges) était déjà enregistré ; seuls le nom de séance et le bloc manquaient,
 * identiques en v1 et v2.
 */
export function fillLegPrescription(s: Session) {
  if (s.type !== 'jambes' || !s.program || s.prescription) return
  const p = legPrescription(s.program.index, 1)
  if (p) s.prescription = p
}

export const db = new AppDB()

const fromCatalogue = (e: CatalogueExercise, existing?: Exercise): Exercise => ({
  ...e,
  source: 'catalogue',
  userModified: false,
  archived: existing?.archived ?? false,
})

const sameContent = (a: Exercise, b: Exercise) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Aligne la table exercises sur data/exercises.json : ajoute les nouveaux exercices et met à jour
 * ceux du catalogue que je n'ai pas modifiés. Mes exercices et mes modifications ne sont jamais écrasés.
 * Renvoie le nombre d'exercices ajoutés ou mis à jour.
 */
export async function syncCatalogue(database: AppDB = db, source: CatalogueExercise[] = catalogue.exercises): Promise<number> {
  return database.transaction('rw', database.exercises, async () => {
    const existing = new Map((await database.exercises.toArray()).map((e) => [e.id, e]))
    const toWrite: Exercise[] = []
    for (const e of source) {
      const current = existing.get(e.id)
      if (current && (current.source === 'user' || current.userModified)) continue
      const next = fromCatalogue(e, current)
      if (!current || !sameContent(current, next)) toWrite.push(next)
    }
    if (toWrite.length) await database.exercises.bulkPut(toWrite)
    return toWrite.length
  })
}

export async function getSettings(database: AppDB = db): Promise<Settings> {
  const stored = await database.settings.get('main')
  const defaults = defaultSettings()
  return stored ? { ...defaults, ...stored, programs: { ...defaults.programs, ...stored.programs } } : defaults
}

export async function updateSettings(update: (s: Settings) => Settings, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    await database.settings.put(update(await getSettings(database)))
  })
}
