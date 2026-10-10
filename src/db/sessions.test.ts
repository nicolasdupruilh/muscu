import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { AppDB, syncCatalogue } from './db'
import {
  abandonSession,
  activeSession,
  adjustRest,
  createExercise,
  deleteSet,
  endRest,
  finishLegSession,
  finishSession,
  logSet,
  saveKneeNextDay,
  startAbsSession,
  startLegSession,
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

describe('séance haut du corps', () => {
  it('démarre une seule séance à la fois', async () => {
    const d = await freshDb()
    const id = await startUpperSession('push', undefined, d)
    expect(await startUpperSession('pull', undefined, d)).toBe(id)
    const s = await activeSession(d)
    expect(s).toMatchObject({ type: 'push', status: 'en-cours' })
    expect(s?.plan?.[0]).toMatchObject({ key: 'push:push-horizontal:1', exerciseId: 'dc-halteres' })
  })

  it("propose à chaque place l'exercice fait la dernière fois", async () => {
    const d = await freshDb()
    const id = await startUpperSession('pull', undefined, d)
    await logSet({ sessionId: id, planKey: 'pull:row:1', templateKey: 'pull:row:1', exerciseId: 'rowing-haltere', setNumber: 1, loadKg: 30, reps: 10 }, undefined, d)
    await finishSession(id, d)
    expect(await activeSession(d)).toBeUndefined()
    await startUpperSession('pull', undefined, d)
    expect((await activeSession(d))?.plan?.[3].exerciseId).toBe('rowing-haltere')
  })

  it('renumérote les séries après une suppression', async () => {
    const d = await freshDb()
    const id = await startUpperSession('push', undefined, d)
    const base = { sessionId: id, planKey: 'push:0', exerciseId: 'dc-halteres', loadKg: 30, reps: 8 }
    const first = await logSet({ ...base, setNumber: 1 }, undefined, d)
    await logSet({ ...base, setNumber: 2 }, undefined, d)
    await logSet({ ...base, setNumber: 3 }, undefined, d)
    await deleteSet(first, d)
    expect((await d.setLogs.toArray()).map((s) => s.setNumber).sort()).toEqual([1, 2])
  })

  it('abandonner supprime la séance et ses séries', async () => {
    const d = await freshDb()
    const id = await startUpperSession('push', undefined, d)
    await logSet({ sessionId: id, planKey: 'push:0', exerciseId: 'dc-halteres', setNumber: 1, loadKg: 30, reps: 8 }, undefined, d)
    await abandonSession(id, d)
    expect(await d.sessions.count()).toBe(0)
    expect(await d.setLogs.count()).toBe(0)
  })
})

describe('chrono de repos', () => {
  it('démarre à la validation et mesure le repos réellement pris', async () => {
    const d = await freshDb()
    const id = await startUpperSession('push', undefined, d)
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
  it('démarre la séance jambes prescrite et la termine avec le check genou', async () => {
    const d = await freshDb()
    const id = await startLegSession(3, undefined, d) // semaine 2, séance B
    const s = (await d.sessions.get(id))!
    expect(s).toMatchObject({ type: 'jambes', program: { programId: 'jambes', index: 3 } })
    expect(s.plan?.find((p) => p.exerciseId === 'rdl')?.targetLoadKg).toBe(82.5)
    expect(s.kneeAdjustment).toBeUndefined()
    await finishLegSession(id, 4, d)
    await saveKneeNextDay(id, 1, d)
    expect((await d.sessions.get(id))!.kneeCheck).toMatchObject({ pendant: 4, lendemain: 1 })
  })

  it('ajuste la séance jambes suivante si le genou était orange', async () => {
    const d = await freshDb()
    await finishLegSession(await startLegSession(2, undefined, d), 4, d) // semaine 2 A, douleur 4 → orange
    const id = await startLegSession(3, undefined, d) // semaine 2 B
    const s = (await d.sessions.get(id))!
    expect(s.kneeAdjustment).toBe('orange')
    expect(s.plan?.find((p) => p.exerciseId === 'rdl')?.targetLoadKg).toBe(80) // charge de la semaine 1
  })

  it('démarre les abdos enchaînés après un push', async () => {
    const d = await freshDb()
    const push = await startUpperSession('push', undefined, d)
    await finishSession(push, d)
    const id = await startAbsSession(0, push, d)
    expect(await d.sessions.get(id)).toMatchObject({ type: 'abdos', parentSessionId: push, program: { programId: 'abdos', index: 0 } })
    expect((await d.sessions.get(id))!.plan).toHaveLength(4)
  })
})
