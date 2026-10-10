import Dexie, { type EntityTable } from 'dexie'
import { catalogue, legPrescription } from '../data'
import { placeKey } from '../logic/upperPlan'
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
    // Trame haut du corps v2 (variantes) : les places « push:5 » deviennent « push:triceps:2 ».
    this.version(4).upgrade(async (tx) => {
      await tx.table('setLogs').toCollection().modify((l: SetLog) => {
        if (l.templateKey) l.templateKey = upperPlaceKey(l.templateKey)
      })
      await tx.table('sessions').toCollection().modify((s: Session) => {
        s.plan?.forEach((p) => {
          if (p.templateKey) p.templateKey = upperPlaceKey(p.templateKey)
        })
      })
    })
  }
}

/** Ordre des slots de la trame haut du corps v1 (une seule variante), pour convertir ses anciennes places. */
const UPPER_V1_SLOTS: Record<string, string[]> = {
  push: ['push-horizontal', 'push-incline', 'push-vertical', 'pec-isolation', 'lateral-raise', 'triceps', 'triceps'],
  pull: ['skill', 'pull-vertical-heavy', 'pull-vertical', 'row', 'biceps', 'biceps-2', 'rear-delt'],
}

/** « push:6 » (6e position de la trame v1) → « push:triceps:2 » (2e place triceps). Les autres clés restent telles quelles. */
export function upperPlaceKey(key: string): string {
  const m = key.match(/^(push|pull):(\d+)$/)
  const slots = m && UPPER_V1_SLOTS[m[1]]
  if (!m || !slots || +m[2] >= slots.length) return key
  const slot = slots[+m[2]]
  const occurrence = slots.slice(0, +m[2] + 1).filter((x) => x === slot).length
  return placeKey(m[1], slot, occurrence)
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
