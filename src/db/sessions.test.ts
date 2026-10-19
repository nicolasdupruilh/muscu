import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { AppDB, syncCatalogue } from './db'
import {
  abandonSession,
  activeSession,
  addFreeExercises,
  adjustRest,
  changeFreeExercise,
  createExercise,
  deleteSet,
  endRest,
  finishSession,
  logSet,
  startAbsSession,
  startUpperSession,
} from './sessions'

let n = 0
const dbs: AppDB[] = []
const freshDb = async () => {
  const d = new AppDB(`sessions-${n++}`)
  dbs.push(d)
  await syncCatalogue(d)
  return d
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

describe('séance haut du corps libre', () => {
  it('démarre vide, une seule séance à la fois', async () => {
    const d = await freshDb()
    const id = await startUpperSession('push', d)
    expect(await startUpperSession('pull', d)).toBe(id)
    expect(await activeSession(d)).toMatchObject({ type: 'push', status: 'en-cours', free: true, plan: [] })
  })

  it('ajoute un exercice, puis deux en superset, et change un exercice pas commencé', async () => {
    const d = await freshDb()
    const id = await startUpperSession('pull', d)
    const first = await addFreeExercises(id, ['rowing-haltere'], d)
    await addFreeExercises(id, ['curl-incline', 'face-pull'], d)
    let plan = (await d.sessions.get(id))!.plan!
    expect(plan.map((p) => [p.exerciseId, p.superset])).toEqual([
      ['rowing-haltere', undefined],
      ['curl-incline', 'S1'],
      ['face-pull', 'S1'],
    ])
    expect(plan[0]).toMatchObject({ key: first, slot: 'row' })
    await changeFreeExercise(id, plan[1].key, 'curl-marteau', d)
    plan = (await d.sessions.get(id))!.plan!
    expect(plan[1]).toMatchObject({ exerciseId: 'curl-marteau', superset: 'S1' })
  })

  it('reprend les séries faites et la fourchette de la dernière fois', async () => {
    const d = await freshDb()
    const id = await startUpperSession('pull', d)
    const key = await addFreeExercises(id, ['rowing-haltere'], d)
    await d.sessions.update(id, { plan: (await d.sessions.get(id))!.plan!.map((p) => ({ ...p, repRange: [10, 15] as [number, number] })) })
    for (const setNumber of [1, 2]) await logSet({ sessionId: id, planKey: key, exerciseId: 'rowing-haltere', setNumber, loadKg: 30, reps: 12, restPlannedSec: 75 }, undefined, d)
    await finishSession(id, d)
    const next = await startUpperSession('pull', d)
    await addFreeExercises(next, ['rowing-haltere'], d)
    expect((await d.sessions.get(next))!.plan![0]).toMatchObject({ sets: 2, repRange: [10, 15], restSec: 75 })
  })

  it('renumérote les séries après une suppression', async () => {
    const d = await freshDb()
    const id = await startUpperSession('push', d)
    const base = { sessionId: id, planKey: 'push:0', exerciseId: 'dc-halteres', loadKg: 30, reps: 8 }
    const first = await logSet({ ...base, setNumber: 1 }, undefined, d)
    await logSet({ ...base, setNumber: 2 }, undefined, d)
    await logSet({ ...base, setNumber: 3 }, undefined, d)
    await deleteSet(first, d)
    expect((await d.setLogs.toArray()).map((s) => s.setNumber).sort()).toEqual([1, 2])
  })

  it('abandonner supprime la séance et ses séries', async () => {
    const d = await freshDb()
    const id = await startUpperSession('push', d)
    await logSet({ sessionId: id, planKey: 'push:0', exerciseId: 'dc-halteres', setNumber: 1, loadKg: 30, reps: 8 }, undefined, d)
    await abandonSession(id, d)
    expect(await d.sessions.count()).toBe(0)
    expect(await d.setLogs.count()).toBe(0)
  })
})

describe('chrono de repos', () => {
  it('démarre à la validation et mesure le repos réellement pris', async () => {
    const d = await freshDb()
    const id = await startUpperSession('push', d)
    const base = { sessionId: id, planKey: 'push:0', exerciseId: 'dc-halteres', loadKg: 30, reps: 8, restPlannedSec: 120 }
    await logSet({ ...base, setNumber: 1 }, 120, d)
    const rest = (await d.sessions.get(id))!.rest!
    expect(new Date(rest.endsAt).getTime() - new Date(rest.startedAt).getTime()).toBe(120_000)
    await adjustRest(id, 15, d)
    expect(new Date((await d.sessions.get(id))!.rest!.endsAt).getTime() - new Date(rest.startedAt).getTime()).toBe(135_000)
    await endRest(id, d)
    expect((await d.sessions.get(id))!.rest!.endedAt).toBeDefined()
    await logSet({ ...base, setNumber: 2 }, undefined, d)
    const sets = await d.setLogs.orderBy('id').toArray()
    expect(sets[0].restTakenSec).toBeUndefined()
    expect(sets[1].restTakenSec).toBeGreaterThanOrEqual(0)
    expect((await d.sessions.get(id))!.rest).toBeUndefined()
  })
})

describe("création d'exercice", () => {
  it("l'ajoute au catalogue et au slot, sans écraser un id existant", async () => {
    const d = await freshDb()
    const id = await createExercise({ name: 'Dips', loadUnit: 'bodyweight+kg', unilateral: false, defaultRestSec: 90, slots: ['triceps'] }, d)
    expect(id).toBe('dips')
    const id2 = await createExercise({ name: 'Dips', loadUnit: 'kg', loadIncrementKg: 5, unilateral: false, defaultRestSec: 90, slots: ['triceps'] }, d)
    expect(id2).toBe('dips-2')
    expect(await d.exercises.get('dips')).toMatchObject({ source: 'user', slots: ['triceps'], loadIncrementKg: 2.5 })
    expect((await d.exercises.where('slots').equals('triceps').primaryKeys())).toContain('dips-2')
    // Une resynchronisation du catalogue ne touche pas à mes exercices.
    expect(await syncCatalogue(d)).toBe(0)
  })
})

describe('séances cadrées', () => {
  it('démarre les abdos seuls, à la position du programme', async () => {
    const d = await freshDb()
    const id = await startAbsSession(0, undefined, d)
    expect(await d.sessions.get(id)).toMatchObject({ type: 'abdos', program: { programId: 'abdos', index: 0 } })
    expect((await d.sessions.get(id))!.plan).toHaveLength(4)
  })
})
