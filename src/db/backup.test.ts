import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { backupFileName, backupStats, checkBackup, exportBackup, importBackup } from './backup'
import { AppDB, syncCatalogue, updateSettings } from './db'
import { createExercise, finishSession, logSet, startUpperSession } from './sessions'

let n = 0
const dbs: AppDB[] = []
const freshDb = async () => {
  const d = new AppDB(`backup-${n++}`)
  dbs.push(d)
  await syncCatalogue(d)
  return d
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

describe('sauvegarde', () => {
  it('exporte puis restaure toutes les données à l’identique', async () => {
    const a = await freshDb()
    await createExercise({ name: 'Curl araignée', loadUnit: 'kg', loadIncrementKg: 1, unilateral: false, defaultRestSec: 60, slots: ['biceps'] }, a)
    await a.exercises.update('dc-halteres', { name: 'DC haltères', userModified: true })
    const id = await startUpperSession('push', undefined, a)
    await logSet({ sessionId: id, planKey: 'push:0', exerciseId: 'dc-halteres', setNumber: 1, loadKg: 30, reps: 10 }, undefined, a)
    await finishSession(id, a)
    await updateSettings((s) => ({ ...s, programs: { ...s.programs, jambes: { startDate: '2026-10-05' } } }), a)

    const backup = JSON.parse(JSON.stringify(await exportBackup(a)))
    expect(checkBackup(backup)).toEqual([])
    expect(backupStats(backup)).toEqual({ sessions: 1, sets: 1, userExercises: 1 })

    const b = await freshDb()
    await startUpperSession('pull', undefined, b) // données qui doivent disparaître
    await importBackup(backup, b)
    expect(await b.sessions.count()).toBe(1)
    expect((await b.sessions.toArray())[0].type).toBe('push')
    expect((await b.setLogs.toArray())[0]).toMatchObject({ loadKg: 30, reps: 10 })
    expect((await b.exercises.get('dc-halteres'))?.name).toBe('DC haltères')
    expect(await b.exercises.get('curl-araignee')).toBeDefined()
    expect((await b.settings.get('main'))?.programs.jambes.startDate).toBe('2026-10-05')
  })

  it('complète le catalogue si la sauvegarde est plus ancienne', async () => {
    const a = await freshDb()
    const backup = await exportBackup(a)
    backup.data.exercises = backup.data.exercises.filter((e) => e.id !== 'slam')
    const b = await freshDb()
    await importBackup(backup, b)
    expect(await b.exercises.get('slam')).toBeDefined()
  })

  it('refuse un fichier qui n’est pas une sauvegarde', () => {
    expect(checkBackup('texte')).toEqual(['Ce fichier ne contient pas de données JSON lisibles.'])
    expect(checkBackup({ foo: 1 })).toEqual(['Ce fichier n’est pas une sauvegarde de cette appli.'])
    expect(checkBackup({ app: 'appli-sport', format: 99, data: {} })).toEqual(['Sauvegarde faite par une version plus récente de l’appli.'])
    expect(checkBackup({ app: 'appli-sport', format: 1, data: { exercises: [], sessions: [], setLogs: [{ sessionId: 4 }], settings: [] } })).toEqual([
      'Des séries ne sont rattachées à aucune séance.',
    ])
  })

  it('nomme le fichier avec la date', () => {
    expect(backupFileName(new Date(2026, 9, 1))).toBe('muscu-sauvegarde-2026-10-01.json')
  })
})
