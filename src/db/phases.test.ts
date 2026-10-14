import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from './backup'
import { AppDB, ensurePhaseStart, syncCatalogue } from './db'
import { logVolley, phaseContext, saveNextDay, setIsoDone, setPhaseManually, startLegSession, submitPhaseTest } from './phases'
import { finishLegSession, logSet } from './sessions'
import { phasePosition, volleyLadder } from '../logic/phases'
import { legPhase, legProgram } from '../data'

const names: string[] = []
let n = 0
afterEach(async () => {
  await Promise.all(names.splice(0).map((name) => Dexie.delete(name)))
})
const freshDb = async (start = new Date(2026, 9, 14, 8)) => {
  const name = `phases-${n++}`
  names.push(name)
  const d = new AppDB(name)
  await syncCatalogue(d)
  await ensurePhaseStart(d, start)
  return d
}
const at = (day: number, h = 18) => new Date(2026, 9, day, h)

/** Séance jambes complète : démarrée, terminée ce jour-là, avec la douleur pendant (et le lendemain si donné). */
async function legDay(d: AppDB, day: number, lendemain?: number) {
  const id = await startLegSession('complete', d, at(day))
  await finishLegSession(id, 1, d)
  await d.sessions.update(id, { date: at(day).toISOString(), endedAt: at(day, 19).toISOString() })
  if (lendemain !== undefined) await saveNextDay([id], lendemain, d, at(day + 1, 8))
  return id
}
const position = async (d: AppDB) => {
  const ctx = await phaseContext(d)
  return phasePosition(legProgram, ctx.entry, ctx.sessions)
}

describe('début du programme par phases', () => {
  it('commence en phase 0 une seule fois', async () => {
    const d = await freshDb()
    expect(await ensurePhaseStart(d)).toBe(false)
    expect(await d.phaseEvents.toArray()).toMatchObject([{ phaseId: 'p0', reason: 'debut' }])
    d.close()
  })

  it('phase 0 : séance A avec les isométriques, copie du prescrit', async () => {
    const d = await freshDb()
    const id = await startLegSession('1h', d, at(14))
    const s = (await d.sessions.get(id))!
    expect(s.phase).toMatchObject({ phaseId: 'p0', label: 'A' })
    expect(s.prescription).toMatchObject({ programVersion: 4, phaseId: 'p0', phaseName: 'Phase 0 : calmer le tendon', label: 'A' })
    expect(s.plan?.map((p) => p.exerciseId)).toContain('iso-genou')
    d.close()
  })
})

describe('progression dans une phase', () => {
  it('phase 1 : A, B, puis semaine 2 ; semaine refaite si un lendemain est orange', async () => {
    const d = await freshDb()
    await setPhaseManually('p1', d, at(14, 9))
    await legDay(d, 15, 1)
    expect(await position(d)).toMatchObject({ week: 1, label: 'B' })
    await legDay(d, 17, 2)
    expect(await position(d)).toMatchObject({ week: 2, instance: 2, label: 'A' })
    await legDay(d, 20, 4) // orange
    await legDay(d, 22, 1)
    expect(await position(d)).toMatchObject({ week: 2, instance: 3, repeat: 'orange' })
    // Semaine 2 : le reverse nordic (optionnel) n'est proposé que si le dernier lendemain est à 2 ou moins.
    const id = await startLegSession('complete', d, at(24))
    expect((await d.sessions.get(id))!.plan!.find((p) => p.exerciseId === 'reverse-nordic')).toMatchObject({ optional: true })
    d.close()
  })
})

describe('réponse du lendemain et régression', () => {
  it('au-dessus de 5 : retour à la phase précédente, avec la raison', async () => {
    const d = await freshDb()
    await setPhaseManually('p2', d, at(14, 9))
    const id = await startLegSession('complete', d, at(15))
    await finishLegSession(id, 2, d)
    const regression = await saveNextDay([id], 6, d, at(16, 8))
    expect(regression).toEqual({ to: 'p1', reason: 'lendemain à 6/10 après la séance jambes' })
    expect((await d.phaseEvents.orderBy('id').last())).toMatchObject({ phaseId: 'p1', reason: 'regression' })
    // La nouvelle phase repart de sa première semaine.
    expect(await position(d)).toMatchObject({ week: 1, label: 'A', instance: 1 })
    d.close()
  })

  it('une réponse le matin vaut pour toutes les séances qui l’attendent', async () => {
    const d = await freshDb()
    const legs = await legDay(d, 15)
    const volley = await logVolley({ day: '2026-10-15', durationMin: 90, pendant: 2 }, d, at(15, 22))
    await saveNextDay([legs, volley], 2, d, at(16, 8))
    expect((await d.sessions.bulkGet([legs, volley])).map((s) => s?.kneeCheck?.lendemain)).toEqual([2, 2])
    d.close()
  })
})

describe('volley en phase 3', () => {
  it('l’échelle monte, et un lendemain de volley au-dessus de 5 fait redescendre sans changer de phase', async () => {
    const d = await freshDb()
    await setPhaseManually('p3', d, at(14, 9))
    const v1 = await logVolley({ day: '2026-10-15', durationMin: 120, ladderStep: 1, attacks: 0, pendant: 1 }, d, at(15, 22))
    await saveNextDay([v1], 1, d, at(16, 8))
    let ctx = await phaseContext(d, at(16, 9))
    expect(volleyLadder(legProgram, legPhase('p3')!, ctx.sessions, ctx.entry, at(16, 9)).next).toBe(2)
    const v2 = await logVolley({ day: '2026-10-19', durationMin: 120, ladderStep: 3, attacks: 25, pendant: 3 }, d, at(19, 22))
    expect(await saveNextDay([v2], 6, d, at(20, 8))).toBeUndefined()
    ctx = await phaseContext(d, at(20, 9))
    expect(volleyLadder(legProgram, legPhase('p3')!, ctx.sessions, ctx.entry, at(20, 9))).toMatchObject({ next: 1, noGymJumps: true })
    expect(ctx.entry.phaseId).toBe('p3')
    // Pas de sauts en salle cette semaine : ils sont sautés dans la séance A.
    const id = await startLegSession('complete', d, at(21))
    const plan = (await d.sessions.get(id))!.plan!
    expect(plan.find((p) => p.exerciseId === 'saut-attaque-max')).toMatchObject({ skipped: true })
    d.close()
  })
})

describe('test de sortie', () => {
  it('phase 0 réussie : la phase 1 commence ; ratée : on reste', async () => {
    const d = await freshDb()
    const fail = await submitPhaseTest({ 'douleur-charge': 4, apprehension: true, 'squat-unipodal': 2 }, d, at(17))
    expect(fail).toEqual({ passed: false, failed: ['douleur-charge'], next: undefined })
    expect((await phaseContext(d)).entry.phaseId).toBe('p0')
    const ok = await submitPhaseTest({ 'douleur-charge': 1, apprehension: true, 'squat-unipodal': 2 }, d, at(18))
    expect(ok).toEqual({ passed: true, failed: [], next: 'p1' })
    expect((await phaseContext(d)).entry).toMatchObject({ phaseId: 'p1', reason: 'test' })
    expect(await d.phaseTests.count()).toBe(2)
    d.close()
  })

  it('critère calculé : lendemain à 2 ou moins après les séances des 2 dernières semaines', async () => {
    const d = await freshDb()
    await setPhaseManually('p1', d, at(14, 9))
    for (const day of [15, 17, 20, 22, 25, 27]) await legDay(d, day, 1)
    const answers = { 'squat-unipodal-incline': 1, 'squat-lent': 2, apprehension: true }
    const res = await submitPhaseTest(answers, d, at(28))
    expect(res).toEqual({ passed: true, failed: [], next: 'p2' })
    d.close()
  })
})

describe('isométriques du jour et sauvegarde', () => {
  it('se cochent, se décochent, et la sauvegarde garde le journal des phases', async () => {
    const d = await freshDb()
    await setIsoDone(true, d, at(15, 9))
    await setIsoDone(true, d, at(15, 12)) // déjà fait : pas de doublon
    expect(await d.sessions.where('type').equals('iso').count()).toBe(1)
    await setIsoDone(false, d, at(15, 13))
    expect(await d.sessions.where('type').equals('iso').count()).toBe(0)

    await setPhaseManually('p1', d, at(16))
    const id = await startLegSession('complete', d, at(17))
    await logSet({ sessionId: id, planKey: 'jambes:1', exerciseId: 'iso-genou', setNumber: 1, durationSec: 45 }, undefined, d)
    const backup = JSON.parse(JSON.stringify(await exportBackup(d)))
    expect(backup.format).toBe(2)
    const e = await freshDb()
    await importBackup(backup, e)
    expect((await e.phaseEvents.toArray()).map((x) => x.phaseId)).toEqual(['p0', 'p1'])
    d.close()
    e.close()
  })

  it('une ancienne sauvegarde (avant les phases) démarre en phase 0', async () => {
    const d = await freshDb()
    const backup = JSON.parse(JSON.stringify(await exportBackup(d)))
    delete backup.data.phaseEvents
    delete backup.data.phaseTests
    backup.format = 1
    const e = await freshDb()
    await setPhaseManually('p2', e)
    await importBackup(backup, e)
    expect((await e.phaseEvents.toArray()).map((x) => x.phaseId)).toEqual(['p0'])
    d.close()
    e.close()
  })
})
