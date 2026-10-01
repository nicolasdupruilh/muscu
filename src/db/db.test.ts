import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { catalogue } from '../data'
import { AppDB, getSettings, syncCatalogue, updateSettings } from './db'

let n = 0
const dbs: AppDB[] = []
const freshDb = () => {
  const d = new AppDB(`test-${n++}`)
  dbs.push(d)
  return d
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

describe('synchronisation du catalogue', () => {
  it('importe tout le catalogue au premier lancement, puis ne réécrit rien', async () => {
    const d = freshDb()
    expect(await syncCatalogue(d)).toBe(catalogue.exercises.length)
    expect(await d.exercises.count()).toBe(catalogue.exercises.length)
    const squat = await d.exercises.get('squat-arriere')
    expect(squat).toMatchObject({ name: 'Squat arrière', source: 'catalogue', userModified: false, archived: false })
    expect(await syncCatalogue(d)).toBe(0)
  })

  it('ajoute les nouveaux exercices sans écraser mes modifications ni mes exercices', async () => {
    const d = freshDb()
    await syncCatalogue(d)
    await d.exercises.update('dc-halteres', { name: 'DC haltères (le mien)', userModified: true })
    await d.exercises.update('rdl', { archived: true })
    await d.exercises.add({ ...catalogue.exercises[0], id: 'perso', name: 'Perso', source: 'user', userModified: false, archived: false })

    const updated = catalogue.exercises.map((e) =>
      e.id === 'dc-halteres' || e.id === 'rdl' ? { ...e, cues: 'nouvelle consigne' } : e,
    )
    updated.push({ ...catalogue.exercises[0], id: 'perso', name: 'Écrasement' })
    updated.push({ ...catalogue.exercises[0], id: 'nouveau', name: 'Nouveau' })

    expect(await syncCatalogue(d, updated)).toBe(2) // rdl mis à jour + nouveau ajouté
    expect((await d.exercises.get('dc-halteres'))?.name).toBe('DC haltères (le mien)')
    expect((await d.exercises.get('dc-halteres'))?.cues).toBe('')
    expect(await d.exercises.get('rdl')).toMatchObject({ cues: 'nouvelle consigne', archived: true })
    expect((await d.exercises.get('perso'))?.name).toBe('Perso')
    expect((await d.exercises.get('nouveau'))?.source).toBe('catalogue')
  })
})

describe('réglages', () => {
  it('ont des valeurs par défaut et se mettent à jour', async () => {
    const d = freshDb()
    expect((await getSettings(d)).programs).toEqual({ jambes: {}, abdos: {} })
    await updateSettings((s) => ({ ...s, programs: { ...s.programs, jambes: { startDate: '2026-10-05' } } }), d)
    expect((await getSettings(d)).programs).toEqual({ jambes: { startDate: '2026-10-05' }, abdos: {} })
  })
})
