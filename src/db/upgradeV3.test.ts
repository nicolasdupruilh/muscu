import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { catalogue } from '../data'
import { AppDB, syncCatalogue, upperPlaceKey } from './db'
import { alternativesFor, finishSession, logSet, replaceExercise, startAbsSession, startLegSession, startUpperSession } from './sessions'

const names: string[] = []
let n = 0
const newName = () => {
  const name = `v3-${n++}`
  names.push(name)
  return name
}
const freshDb = async () => {
  const d = new AppDB(newName())
  await syncCatalogue(d)
  return d
}
afterEach(async () => {
  await Promise.all(names.splice(0).map((name) => Dexie.delete(name)))
})

describe('variantes', () => {
  it('push 1 h : 5 exercices avec un superset, puis 2 tours d’abdos', async () => {
    const d = await freshDb()
    const id = await startUpperSession('push', '1h', d)
    const s = (await d.sessions.get(id))!
    expect(s.variant).toEqual({ id: '1h', label: '1 h', estimatedMin: 65, abdosRounds: 2 })
    expect(s.plan?.map((p) => `${p.templateKey}${p.superset ? `[${p.superset}]` : ''}`)).toEqual([
      'push:push-horizontal:1',
      'push:push-incline:1',
      'push:push-vertical:1',
      'push:lateral-raise:1[S1]',
      'push:triceps:1[S1]',
    ])
    await finishSession(id, d)
    const abs = (await d.sessions.get(await startAbsSession(0, id, d)))!
    expect(abs.plan?.every((p) => p.sets === 2 && p.superset === 'circuit')).toBe(true)
    d.close()
  })

  it('abdos seuls : le nombre de tours du programme', async () => {
    const d = await freshDb()
    const abs = (await d.sessions.get(await startAbsSession(0, undefined, d)))!
    expect(abs.plan?.map((p) => p.sets)).toEqual([3, 3, 3, 3])
    d.close()
  })

  it('jambes B 1 h : la variante choisie, avec l’épaulé', async () => {
    const d = await freshDb()
    const id = await startLegSession(1, '1h', d) // semaine 1, séance B
    const s = (await d.sessions.get(id))!
    expect(s.variant).toMatchObject({ id: '1h', estimatedMin: 65 })
    expect(s.plan?.map((p) => p.exerciseId)).toEqual(['echauffement-jambes', 'epaule', 'rdl', 'hip-thrust', 'leg-curl', 'copenhague'])
    expect(s.plan?.filter((p) => p.superset === 'S1').map((p) => p.exerciseId)).toEqual(['hip-thrust', 'leg-curl', 'copenhague'])
    d.close()
  })

  it('sans variante précisée : la complète', async () => {
    const d = await freshDb()
    const s = (await d.sessions.get(await startLegSession(1, undefined, d)))!
    expect(s.variant?.id).toBe('complete')
    expect(s.plan?.map((p) => p.exerciseId)).toContain('traineau')
    d.close()
  })
})

describe('remplacement par une alternative', () => {
  it('garde l’exercice prévu et ce que j’ai vraiment fait', async () => {
    const d = await freshDb()
    const id = await startLegSession(1, 'complete', d)
    const leg = () => d.sessions.get(id).then((s) => s!.plan!)
    const curl = (await leg()).find((p) => p.exerciseId === 'leg-curl')!
    expect(curl.targetLoadKg).toBe(55)
    const copenhague = (await leg()).find((p) => p.exerciseId === 'copenhague')!
    expect(alternativesFor('copenhague', await d.exercises.toArray())).toEqual(['adducteurs-machine'])
    expect(alternativesFor('adducteurs-machine', await d.exercises.toArray())).toEqual(['copenhague'])

    await replaceExercise(id, copenhague.key, 'adducteurs-machine', d)
    expect((await leg()).find((p) => p.key === copenhague.key)).toMatchObject({
      exerciseId: 'adducteurs-machine',
      replaced: { exerciseId: 'copenhague' },
    })
    await logSet({ sessionId: id, planKey: copenhague.key, exerciseId: 'adducteurs-machine', setNumber: 1, loadKg: 40, reps: 12 }, undefined, d)
    expect((await d.setLogs.toArray())[0].exerciseId).toBe('adducteurs-machine')

    // Remplacer un exercice qui a une charge cible : elle ne vaut plus ; revenir à l'exercice prévu la rétablit.
    await replaceExercise(id, curl.key, 'curl-poulie', d)
    expect((await leg()).find((p) => p.key === curl.key)).toMatchObject({ exerciseId: 'curl-poulie', targetLoadKg: undefined, replaced: { exerciseId: 'leg-curl', targetLoadKg: 55 } })
    await replaceExercise(id, curl.key, 'leg-curl', d)
    const back = (await leg()).find((p) => p.key === curl.key)!
    expect(back).toMatchObject({ exerciseId: 'leg-curl', targetLoadKg: 55 })
    expect(back.replaced).toBeUndefined()
    d.close()
  })
})

describe('migration de la trame haut du corps v1', () => {
  it('convertit les anciennes places en places par slot', () => {
    expect(upperPlaceKey('push:0')).toBe('push:push-horizontal:1')
    expect(upperPlaceKey('push:5')).toBe('push:triceps:1')
    expect(upperPlaceKey('push:6')).toBe('push:triceps:2')
    expect(upperPlaceKey('pull:3')).toBe('pull:row:1')
    expect(upperPlaceKey('pull:triceps:1')).toBe('pull:triceps:1')
    expect(upperPlaceKey('extra:123')).toBe('extra:123')
  })

  it('garde l’exercice fait à chaque place d’une séance à l’autre, après la mise à jour', async () => {
    const name = newName()
    const old = new Dexie(name)
    old.version(3).stores({
      exercises: 'id, category, *slots',
      sessions: '++id, date, type, status, [type+date]',
      setLogs: '++id, sessionId, exerciseId, templateKey, [exerciseId+at]',
      settings: 'id',
    })
    await old.table('exercises').bulkAdd(catalogue.exercises.map((e) => ({ ...e, source: 'catalogue', userModified: false, archived: false })))
    await old.table('sessions').add({
      id: 1,
      date: '2026-10-05T18:00:00Z',
      endedAt: '2026-10-05T19:00:00Z',
      type: 'pull',
      status: 'terminee',
      plan: [{ key: 'pull:3', templateKey: 'pull:3', slot: 'row', exerciseId: 'rowing-haltere', sets: 3, repRange: [8, 12], restSec: 120 }],
    })
    await old.table('setLogs').add({ sessionId: 1, planKey: 'pull:3', templateKey: 'pull:3', exerciseId: 'rowing-haltere', setNumber: 1, loadKg: 30, reps: 10, done: true, at: '2026-10-05T18:30:00Z' })
    old.close()

    const d = new AppDB(name)
    await syncCatalogue(d)
    const log = (await d.setLogs.toArray())[0]
    expect(log).toMatchObject({ planKey: 'pull:3', templateKey: 'pull:row:1', loadKg: 30 })
    expect((await d.sessions.get(1))!.plan![0].templateKey).toBe('pull:row:1')
    // Le rowing haltère est reproposé à la place « Rowing », dans les deux variantes.
    for (const variant of ['1h', 'complete']) {
      const id = await startUpperSession('pull', variant, d)
      expect((await d.sessions.get(id))!.plan!.find((p) => p.slot === 'row')?.exerciseId).toBe('rowing-haltere')
      await d.sessions.delete(id)
    }
    d.close()
  })
})

describe('remplacement entre durée et reps', () => {
  it('passe à 8 à 12 reps quand un gainage en durée est remplacé par un exercice en reps, et revient', async () => {
    const d = await freshDb()
    const id = await startLegSession(1, 'complete', d)
    const leg = () => d.sessions.get(id).then((s) => s!.plan!)
    const copenhague = (await leg()).find((p) => p.exerciseId === 'copenhague')!
    expect(copenhague).toMatchObject({ prescribedReps: '20 s', repRange: [20, 20] })
    await replaceExercise(id, copenhague.key, 'adducteurs-machine', d)
    expect((await leg()).find((p) => p.key === copenhague.key)).toMatchObject({ prescribedReps: '8-12', repRange: [8, 12], sets: 3 })
    await replaceExercise(id, copenhague.key, 'copenhague', d)
    expect((await leg()).find((p) => p.key === copenhague.key)).toMatchObject({ exerciseId: 'copenhague', prescribedReps: '20 s', repRange: [20, 20] })
    d.close()
  })
})
