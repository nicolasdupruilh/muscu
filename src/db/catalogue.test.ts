import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { resetToCatalogue, setArchived, updateExercise } from './catalogue'
import { AppDB, syncCatalogue } from './db'
import { createExercise, startUpperSession } from './sessions'

let n = 0
const dbs: AppDB[] = []
const freshDb = async () => {
  const d = new AppDB(`catalogue-${n++}`)
  dbs.push(d)
  await syncCatalogue(d)
  return d
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

describe('catalogue', () => {
  it('modifier un exercice du catalogue le protège des mises à jour', async () => {
    const d = await freshDb()
    await updateExercise('dc-halteres', { name: '  DC haltères  ', defaultRestSec: 180, slots: ['push-horizontal', 'push-incline'] }, d)
    const ex = await d.exercises.get('dc-halteres')
    expect(ex).toMatchObject({ name: 'DC haltères', defaultRestSec: 180, userModified: true })
    expect(await syncCatalogue(d)).toBe(0)
    expect((await d.exercises.get('dc-halteres'))?.name).toBe('DC haltères')
    // Le nouveau slot le rend proposable dans le développé incliné.
    expect(await d.exercises.where('slots').equals('push-incline').primaryKeys()).toContain('dc-halteres')
  })

  it('revenir à la version du catalogue annule mes modifications', async () => {
    const d = await freshDb()
    await updateExercise('dc-halteres', { name: 'DC haltères' }, d)
    await resetToCatalogue('dc-halteres', d)
    expect(await d.exercises.get('dc-halteres')).toMatchObject({ name: 'Développé couché haltères', userModified: false })
  })

  it('un exercice que j’ai créé reste « perso » quand je le modifie', async () => {
    const d = await freshDb()
    const id = await createExercise({ name: 'Curl araignée', loadUnit: 'kg', unilateral: false, defaultRestSec: 60, slots: [] }, d)
    await updateExercise(id, { loadUnit: 'bodyweight' }, d)
    const ex = await d.exercises.get(id)
    expect(ex).toMatchObject({ source: 'user', userModified: false, loadUnit: 'bodyweight' })
    expect(ex?.loadIncrementKg).toBeUndefined()
    await updateExercise(id, { loadUnit: 'kg' }, d)
    expect((await d.exercises.get(id))?.loadIncrementKg).toBe(2.5)
  })

  it('refuse un nom vide', async () => {
    const d = await freshDb()
    await expect(updateExercise('dc-halteres', { name: '   ' }, d)).rejects.toThrow('nom')
  })

  it('un exercice archivé n’est plus proposé dans la trame et le reste après une synchronisation', async () => {
    const d = await freshDb()
    await setArchived('dc-halteres', true, d)
    await syncCatalogue(d)
    expect((await d.exercises.get('dc-halteres'))?.archived).toBe(true)
    // La place « développé horizontal » propose un autre exercice disponible de son slot.
    const id = await startUpperSession('push', undefined, d)
    expect((await d.sessions.get(id))?.plan?.[0].exerciseId).toBe('dc-barre')
  })
})
