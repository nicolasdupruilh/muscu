// Gestion du catalogue depuis les réglages : modifier, archiver, revenir à la version de data/exercises.json.
import { catalogue } from '../data'
import { db, syncCatalogue, type AppDB } from './db'
import type { Exercise } from './models'

/** Champs modifiables d'un exercice. */
export type ExerciseChanges = Partial<
  Pick<Exercise, 'name' | 'loadUnit' | 'loadIncrementKg' | 'unilateral' | 'defaultRestSec' | 'slots' | 'cues' | 'category' | 'equipment'>
>

const withLoad = (unit: Exercise['loadUnit']) => unit === 'kg' || unit === 'bodyweight+kg'

/**
 * Modifie un exercice. Un exercice du catalogue modifié est marqué comme tel :
 * les mises à jour de data/exercises.json ne l'écraseront plus.
 */
export async function updateExercise(id: string, changes: ExerciseChanges, database: AppDB = db) {
  await database.transaction('rw', database.exercises, async () => {
    const current = await database.exercises.get(id)
    if (!current) throw new Error(`Exercice introuvable : ${id}`)
    const next: Exercise = { ...current, ...changes, name: (changes.name ?? current.name).trim() }
    if (!next.name) throw new Error('Le nom ne peut pas être vide.')
    // Pas de cran de charge pour un exercice sans charge ; un cran par défaut sinon.
    if (!withLoad(next.loadUnit)) delete next.loadIncrementKg
    else next.loadIncrementKg ??= 2.5
    if (next.source === 'catalogue') next.userModified = true
    await database.exercises.put(next)
  })
}

/** Archive (ou réactive) un exercice : archivé, il n'est plus proposé mais son historique reste. */
export async function setArchived(id: string, archived: boolean, database: AppDB = db) {
  await database.exercises.update(id, { archived })
}

/** Annule mes modifications d'un exercice du catalogue : il reprend la version de data/exercises.json. */
export async function resetToCatalogue(id: string, database: AppDB = db) {
  if (!catalogue.exercises.some((e) => e.id === id)) return
  await database.exercises.update(id, { userModified: false })
  await syncCatalogue(database)
}
