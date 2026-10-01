import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { AppDB, syncCatalogue } from './db'
import { abandonSession, activeSession, adjustRest, createExercise, deleteSet, endRest, finishSession, logSet, startUpperSession } from './sessions'

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

describe('séance haut du corps', () => {
  it('démarre une seule séance à la fois', async () => {
    const d = await freshDb()
    const id = await startUpperSession('push', d)
    expect(await startUpperSession('pull', d)).toBe(id)
    const s = await activeSession(d)
    expect(s).toMatchObject({ type: 'push', status: 'en-cours' })
    expect(s?.plan?.[0]).toMatchObject({ key: 'push:0', exerciseId: 'dc-halteres' })
  })

  it("propose à chaque place l'exercice fait la dernière fois", async () => {
    const d = await freshDb()
    const id = await startUpperSession('pull', d)
    await logSet({ sessionId: id, planKey: 'pull:3', templateKey: 'pull:3', exerciseId: 'rowing-haltere', setNumber: 1, loadKg: 30, reps: 10 }, undefined, d)
    await finishSession(id, d)
    expect(await activeSession(d)).toBeUndefined()
    await startUpperSession('pull', d)
    expect((await activeSession(d))?.plan?.[3].exerciseId).toBe('rowing-haltere')
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
