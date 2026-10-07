import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { catalogue } from '../data'
import { AppDB, syncCatalogue } from './db'
import { updateExercise } from './catalogue'
import { createExercise, startLegSession } from './sessions'

let n = 0
const names: string[] = []
afterEach(async () => {
  await Promise.all(names.splice(0).map((name) => Dexie.delete(name)))
})
const newName = () => {
  const name = `upgrade-${n++}`
  names.push(name)
  return name
}

describe('mise à jour du programme jambes v2', () => {
  it('une séance démarrée enregistre une copie de ce qui est prescrit', async () => {
    const d = new AppDB(newName())
    await syncCatalogue(d)
    const id = await startLegSession(0, d)
    const s = (await d.sessions.get(id))!
    expect(s.prescription).toEqual({ programVersion: 2, name: 'Jambes A : force et sauts', week: 1, label: 'A', blockName: 'Base tendon', deload: false })
    expect(s.plan?.map((p) => p.exerciseId)).toContain('pogos')
    d.close()
  })

  it('les séances jambes déjà en base reçoivent leur copie (v1) sans rien perdre', async () => {
    const name = newName()
    // Base telle qu'elle était avant la mise à jour (schéma version 2, programme v1).
    const old = new Dexie(name)
    old.version(2).stores({
      exercises: 'id, category, *slots',
      sessions: '++id, date, type, status, [type+date]',
      setLogs: '++id, sessionId, exerciseId, templateKey, [exerciseId+at]',
      settings: 'id',
    })
    const v1Plan = [{ key: 'jambes:1', exerciseId: 'box-jump', sets: 4, repRange: [3, 3], restSec: 90, prescribedReps: 3 }]
    await old.table('sessions').add({
      id: 7,
      date: '2026-10-02T17:00:00Z',
      endedAt: '2026-10-02T18:30:00Z',
      type: 'jambes',
      status: 'terminee',
      program: { programId: 'jambes', index: 0 },
      plan: v1Plan,
      kneeCheck: { pendant: 1, lendemain: 0 },
    })
    await old.table('sessions').add({ id: 8, date: '2026-10-03T17:00:00Z', type: 'push', status: 'terminee' })
    await old.table('setLogs').add({ sessionId: 7, planKey: 'jambes:1', exerciseId: 'box-jump', setNumber: 1, reps: 3, done: true, at: '2026-10-02T17:20:00Z' })
    await old.table('exercises').add({ ...catalogue.exercises[0], id: 'perso', name: 'Mon exercice', source: 'user', userModified: false, archived: false })
    old.close()

    const d = new AppDB(name)
    await syncCatalogue(d)
    const legs = (await d.sessions.get(7))!
    expect(legs.prescription).toMatchObject({ programVersion: 1, name: 'Jambes A : force et sauts', week: 1, label: 'A' })
    // Ce qui était prescrit en v1 est intact : 4 × 3 box jumps, pas les pogos de la v2.
    expect(legs.plan).toEqual(v1Plan)
    expect(legs.kneeCheck).toEqual({ pendant: 1, lendemain: 0 })
    expect((await d.sessions.get(8))!.prescription).toBeUndefined()
    expect(await d.setLogs.count()).toBe(1)
    expect((await d.exercises.get('perso'))?.name).toBe('Mon exercice')
    expect(await d.exercises.get('pogos')).toBeDefined()
    d.close()
  })

  it('le catalogue v2 ajoute les nouveaux exercices sans toucher aux miens ni à mes modifications', async () => {
    const d = new AppDB(newName())
    const v2Only = new Set(['pogos', 'sauts-lateraux-ligne', 'drop-landing-unipodal', 'skater-bound', 'hops-multidirectionnels', 'bond-unipodal', 'hops-lateraux-unipodaux', 'bonds-unipodaux-enchaines'])
    await syncCatalogue(d, catalogue.exercises.filter((e) => !v2Only.has(e.id))) // catalogue v1
    // Cas limite : un exercice perso créé avant la mise à jour avec le même identifiant qu'un nouvel exercice.
    await createExercise({ name: 'Pogos', loadUnit: 'none', unilateral: false, defaultRestSec: 30, slots: [] }, d)
    await updateExercise('box-jump', { cues: 'Ma consigne' }, d)
    expect(await syncCatalogue(d)).toBeGreaterThanOrEqual(7)
    for (const id of v2Only) if (id !== 'pogos') expect(await d.exercises.get(id)).toMatchObject({ source: 'catalogue' })
    // Mon exercice est conservé tel quel, jamais écrasé.
    expect(await d.exercises.get('pogos')).toMatchObject({ source: 'user', defaultRestSec: 30 })
    expect((await d.exercises.get('box-jump'))?.cues).toBe('Ma consigne')
    d.close()
  })
})
