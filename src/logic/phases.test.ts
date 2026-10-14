import { describe, expect, it } from 'vitest'
import programJson from '../../data/programme-jambes.json'
import exercisesJson from '../../data/exercises.json'
import type { LegProgramFile } from '../data/types'
import type { PhaseEvent, Session, SetLog } from '../db/models'
import {
  AUTO_CRITERIA,
  evaluateTest,
  checksIn,
  currentEntry,
  conditionMet,
  describeCondition,
  jumpGuard,
  minDurationReached,
  overMaxDuration,
  parseCondition,
  phasePosition,
  regressionAfter,
  volleyLadder,
  type AutoContext,
} from './phases'

const program = programJson as unknown as LegProgramFile
const plyo = new Set(exercisesJson.exercises.filter((e) => e.category === 'plyo').map((e) => e.id))
const isJump = (id: string) => plyo.has(id)
const phase = (id: string) => program.phases.find((p) => p.id === id)!

const day = (d: number, h = 18) => new Date(2026, 9, d, h).toISOString()
const entry = (phaseId: string, d = 14, id = 1): PhaseEvent => ({ id, at: day(d, 8), phaseId, reason: 'debut' })

let nextId = 100
/** Séance jambes terminée dans une entrée de phase. */
const leg = (e: PhaseEvent, d: number, week: number, instance: number, label: string, lendemain?: number, loadBonusKg = 0): Session => ({
  id: nextId++,
  type: 'jambes',
  status: 'terminee',
  date: day(d),
  endedAt: day(d, 19),
  phase: { entryId: e.id!, phaseId: e.phaseId, week, instance, label, loadBonusKg },
  kneeCheck: { pendant: 1, ...(lendemain !== undefined && { lendemain }) },
})
const volley = (e: PhaseEvent, d: number, step: number | undefined, lendemain?: number, attacks = 20): Session => ({
  id: nextId++,
  type: 'volley',
  status: 'terminee',
  date: day(d, 20),
  endedAt: day(d, 22),
  phase: { entryId: e.id!, phaseId: e.phaseId },
  volley: { durationMin: 120, ladderStep: step, attacks },
  kneeCheck: { pendant: 1, ...(lendemain !== undefined && { lendemain }) },
})

describe('position dans la phase', () => {
  it('phase 0 : une séance fixe, sans semaines', () => {
    const pos = phasePosition(program, entry('p0'), [])
    expect(pos).toMatchObject({ label: 'A', instance: 1 })
    expect(pos.week).toBeUndefined()
    expect(pos.session?.name).toMatch(/isométriques/)
  })

  it('phase 1 : A puis B, puis semaine suivante', () => {
    const e = entry('p1')
    expect(phasePosition(program, e, [])).toMatchObject({ week: 1, instance: 1, label: 'A', weeksDone: 0 })
    const a = leg(e, 15, 1, 1, 'A', 1)
    expect(phasePosition(program, e, [a])).toMatchObject({ week: 1, label: 'B', doneLabels: ['A'] })
    const b = leg(e, 17, 1, 1, 'B', 2)
    expect(phasePosition(program, e, [a, b])).toMatchObject({ week: 2, instance: 2, label: 'A', weeksDone: 1, repeat: undefined })
  })

  it('refait la même semaine si un lendemain de la semaine est orange (jambes ou volley)', () => {
    const e = entry('p1')
    const s = [leg(e, 15, 1, 1, 'A', 1), leg(e, 17, 1, 1, 'B', 4)]
    expect(phasePosition(program, e, s)).toMatchObject({ week: 1, instance: 2, repeat: 'orange' })
    const e3 = entry('p3')
    const s3 = [leg(e3, 15, 1, 1, 'A', 1), volley(e3, 16, 1, 3), leg(e3, 18, 1, 1, 'B', 0)]
    expect(phasePosition(program, e3, s3)).toMatchObject({ week: 1, repeat: 'orange' })
  })

  it('répète la dernière semaine en ajoutant 2,5 kg en phase 1, seulement si le lendemain est resté vert', () => {
    const e = entry('p1')
    const s = [
      leg(e, 15, 1, 1, 'A', 1), leg(e, 17, 1, 1, 'B', 1),
      leg(e, 20, 2, 2, 'A', 1), leg(e, 22, 2, 2, 'B', 1),
      leg(e, 25, 3, 3, 'A', 2), leg(e, 27, 3, 3, 'B', 0),
    ]
    const pos = phasePosition(program, e, s)
    expect(pos).toMatchObject({ week: 3, instance: 4, repeat: 'derniere', loadBonusKg: 2.5, weeksDone: 3 })
    // Lendemain inconnu après une séance de la répétition : pas d'ajout de charge la fois suivante.
    const s2 = [...s, leg(e, 29, 3, 4, 'A', 1, 2.5), leg(e, 31, 3, 4, 'B', undefined, 2.5)]
    expect(phasePosition(program, e, s2)).toMatchObject({ week: 3, instance: 5, loadBonusKg: 2.5 })
  })

  it('ne compte que les séances de l’entrée de phase en cours', () => {
    const old = entry('p1', 1, 1)
    const now = entry('p1', 10, 2)
    expect(phasePosition(program, now, [leg(old, 2, 1, 1, 'A', 1)])).toMatchObject({ week: 1, label: 'A' })
  })
})

describe('durée minimale', () => {
  it('phase 0 : 3 jours calendaires', () => {
    const pos = phasePosition(program, entry('p0', 14), [])
    expect(minDurationReached(pos, new Date(2026, 9, 16, 20))).toBe(false)
    expect(minDurationReached(pos, new Date(2026, 9, 17, 7))).toBe(true)
    expect(overMaxDuration(pos, new Date(2026, 9, 28))).toBe(false)
    expect(overMaxDuration(pos, new Date(2026, 9, 29))).toBe(true)
  })

  it('phases 1 à 3 : 3 semaines du programme terminées', () => {
    const e = entry('p1')
    const s = [leg(e, 15, 1, 1, 'A', 1), leg(e, 17, 1, 1, 'B', 1), leg(e, 20, 2, 2, 'A', 1), leg(e, 22, 2, 2, 'B', 1), leg(e, 25, 3, 3, 'A', 1)]
    expect(minDurationReached(phasePosition(program, e, s), new Date(2026, 10, 30))).toBe(false)
    s.push(leg(e, 27, 3, 3, 'B', 1))
    expect(minDurationReached(phasePosition(program, e, s), new Date(2026, 9, 27))).toBe(true)
  })
})

describe('régressions', () => {
  const run = (phaseId: string, sessions: (e: PhaseEvent) => Session[]) => {
    const e = entry(phaseId)
    return regressionAfter(program, phaseId, checksIn(sessions(e), e))
  }

  it('lendemain au-dessus de 5 : phase précédente', () => {
    expect(run('p2', (e) => [leg(e, 15, 1, 1, 'A', 6)])).toEqual({ to: 'p1', reason: 'lendemain à 6/10 après la séance jambes' })
    expect(run('p1', (e) => [leg(e, 15, 1, 1, 'A', 5)])).toBeUndefined()
  })

  it('au-dessus de 2 trois fois de suite : phase précédente', () => {
    expect(run('p2', (e) => [leg(e, 15, 1, 1, 'A', 3), leg(e, 17, 1, 1, 'B', 4)])).toBeUndefined()
    expect(run('p2', (e) => [leg(e, 15, 1, 1, 'A', 3), leg(e, 17, 1, 1, 'B', 4), leg(e, 20, 1, 2, 'A', 3)])).toEqual({
      to: 'p1',
      reason: 'lendemain au-dessus de 2/10 trois fois de suite',
    })
    expect(run('p2', (e) => [leg(e, 15, 1, 1, 'A', 3), leg(e, 17, 1, 1, 'B', 1), leg(e, 20, 1, 2, 'A', 3)])).toBeUndefined()
  })

  it('phase 3 : un volley au-dessus de 5 fait redescendre l’échelle, pas la phase', () => {
    expect(run('p3', (e) => [volley(e, 15, 3, 6)])).toBeUndefined()
    expect(run('p3', (e) => [leg(e, 15, 1, 1, 'A', 6)])).toEqual({ to: 'p2', reason: 'lendemain à 6/10 après la séance jambes' })
  })

  it('phase 4 : retour en phase 3 seulement après deux fois au-dessus de 5', () => {
    expect(run('p4', (e) => [leg(e, 15, 1, 1, 'A', 6)])).toBeUndefined()
    expect(run('p4', (e) => [leg(e, 15, 1, 1, 'A', 6), volley(e, 16, undefined, 7)])).toEqual({ to: 'p3', reason: 'lendemain au-dessus de 5/10 deux fois de suite' })
  })

  it('jamais sous la phase 0', () => {
    expect(run('p0', (e) => [leg(e, 15, 0, 1, 'A', 8)])).toBeUndefined()
  })
})

describe('échelle volley', () => {
  const now = new Date(2026, 9, 21, 12)
  const ladder = (sessions: (e: PhaseEvent) => Session[]) => {
    const e = entry('p3')
    return volleyLadder(program, phase('p3'), sessions(e), e, now)
  }

  it('commence à la marche 1', () => {
    expect(ladder(() => [])).toMatchObject({ next: 1, pending: false })
  })

  it('monte si vert, reste si orange, descend de deux si rouge', () => {
    expect(ladder((e) => [volley(e, 15, 2, 1)])).toMatchObject({ current: 2, next: 3 })
    expect(ladder((e) => [volley(e, 15, 5, 0)])).toMatchObject({ next: 5 })
    expect(ladder((e) => [volley(e, 15, 3, 4)])).toMatchObject({ next: 3 })
    expect(ladder((e) => [volley(e, 20, 3, 6)])).toMatchObject({ next: 1, noGymJumps: true })
    expect(ladder((e) => [volley(e, 15, 4, 6)])).toMatchObject({ next: 2, noGymJumps: false }) // semaine précédente
  })

  it('attend la réponse du lendemain', () => {
    expect(ladder((e) => [volley(e, 20, 2)])).toMatchObject({ current: 2, next: 2, pending: true })
  })
})

describe('critères de sortie calculés', () => {
  const ctx = (phaseId: string, sessions: (e: PhaseEvent) => Session[], logs: SetLog[] = [], now = new Date(2026, 10, 1)): AutoContext => {
    const e = entry(phaseId, 14)
    return { program, entry: e, sessions: sessions(e), logs, isJump, now }
  }

  it('lendemain à 2 ou moins après chaque séance des 2 dernières semaines', () => {
    expect(AUTO_CRITERIA['lendemain-2sem'](ctx('p1', (e) => [leg(e, 20, 1, 1, 'A', 1), leg(e, 25, 1, 1, 'B', 2)]))).toEqual({
      ok: true,
      detail: '2 séances, lendemain au plus 2/10.',
    })
    expect(AUTO_CRITERIA['lendemain-2sem'](ctx('p1', (e) => [leg(e, 20, 1, 1, 'A', 3)])).ok).toBe(false)
    expect(AUTO_CRITERIA['lendemain-2sem'](ctx('p1', (e) => [leg(e, 20, 1, 1, 'A')])).detail).toBe('1 séance sans réponse du lendemain.')
    // Séance de plus de 2 semaines : ne compte pas.
    expect(AUTO_CRITERIA['lendemain-2sem'](ctx('p1', (e) => [leg(e, 15, 1, 1, 'A', 4), leg(e, 25, 1, 1, 'B', 1)])).ok).toBe(true)
  })

  it('lendemain à 2 ou moins après chaque séance de sauts', () => {
    const sessions = (e: PhaseEvent) => [leg(e, 20, 1, 1, 'A', 1), { ...leg(e, 25, 1, 1, 'B', 4), id: 999 }]
    const logs: SetLog[] = [{ sessionId: 999, planKey: 'k', exerciseId: 'leg-curl', setNumber: 1, done: true, at: '' }]
    // La séance à 4/10 n'a pas de sauts, celle à 1/10 non plus : aucune séance de sauts.
    expect(AUTO_CRITERIA['lendemain-sauts'](ctx('p2', sessions, logs)).ok).toBe(false)
    const withJumps: SetLog[] = [{ sessionId: 999, planKey: 'k', exerciseId: 'pogos', setNumber: 1, done: true, at: '' }]
    expect(AUTO_CRITERIA['lendemain-sauts'](ctx('p2', sessions, withJumps)).detail).toBe('Lendemain jusqu’à 4/10 sur les 2 dernières semaines.')
  })

  it('marche 4 tenue 2 semaines avec un lendemain vert', () => {
    const now = new Date(2026, 10, 3)
    expect(AUTO_CRITERIA['volley-complet'](ctx('p3', (e) => [volley(e, 18, 4, 1), volley(e, 25, 4, 2), volley(e, 30, 4, 1)], [], now)).ok).toBe(true)
    expect(AUTO_CRITERIA['volley-complet'](ctx('p3', (e) => [volley(e, 25, 4, 1)], [], now)).detail).toMatch(/sur 14/)
    expect(AUTO_CRITERIA['volley-complet'](ctx('p3', (e) => [volley(e, 18, 4, 1), volley(e, 25, 4, 3)], [], now)).ok).toBe(false)
  })
})

describe('conditions', () => {
  it('se lisent et s’évaluent', () => {
    expect(parseCondition('semaine>=2 et lendemain<=2')).toEqual([
      { variable: 'semaine', op: '>=', value: 2 },
      { variable: 'lendemain', op: '<=', value: 2 },
    ])
    expect(parseCondition('genou ok')).toBeUndefined()
    expect(conditionMet('semaine>=2', { semaine: 2 })).toBe(true)
    expect(conditionMet('semaine>=2', { semaine: 1 })).toBe(false)
    expect(conditionMet('semaine>=2 et lendemain<=2', { semaine: 3, lendemain: 2 })).toBe(true)
    expect(conditionMet('semaine>=2 et lendemain<=2', { semaine: 3, lendemain: 3 })).toBe(false)
    expect(conditionMet('semaine>=2 et lendemain<=2', { semaine: 3 })).toBe(false) // lendemain inconnu
    expect(describeCondition('semaine>=2 et lendemain<=2')).toBe('si semaine ≥ 2 et lendemain ≤ 2/10')
  })
})

describe('garde-fous sur les sauts', () => {
  const jumpSession = (d: number): Session => ({ id: nextId++, type: 'jambes', status: 'terminee', date: day(d), endedAt: day(d, 19) })
  const guard = (phaseId: string, sessions: Session[], logs: SetLog[], now: Date) =>
    jumpGuard({ program, entry: entry(phaseId), sessions, logs, isJump, now }, phase(phaseId))

  it('phase 2 : jamais deux jours de suite, 2 séances par semaine au plus', () => {
    const a = jumpSession(20) // mardi
    const logs = (s: Session): SetLog => ({ sessionId: s.id!, planKey: 'k', exerciseId: 'pogos', setNumber: 1, done: true, at: '' })
    expect(guard('p2', [a], [logs(a)], new Date(2026, 9, 21, 18))).toMatch(/deux jours de suite/)
    expect(guard('p2', [a], [logs(a)], new Date(2026, 9, 22, 18))).toBeUndefined()
    const b = jumpSession(22)
    expect(guard('p2', [a, b], [logs(a), logs(b)], new Date(2026, 9, 24, 18))).toMatch(/Déjà 2 séances/)
  })

  it('phase 3 : pas de sauts à moins de 48 h d’un volley', () => {
    const e = entry('p3')
    const v = volley(e, 20, 2, 1)
    expect(guard('p3', [v], [], new Date(2026, 9, 21, 18))).toMatch(/48 h/)
    expect(guard('p3', [v], [], new Date(2026, 9, 23, 18))).toBeUndefined()
  })
})

describe('test de sortie', () => {
  const p0 = phase('p0').exitCriteria!
  const p2 = phase('p2').exitCriteria!

  it('valide la phase 0 quand toutes les réponses sont dans les seuils', () => {
    expect(evaluateTest(p0, { 'douleur-charge': 2, apprehension: true, 'squat-unipodal': 3 }, {})).toEqual({ passed: true, failed: [] })
    expect(evaluateTest(p0, { 'douleur-charge': 3, apprehension: false, 'squat-unipodal': 3 }, {})).toEqual({
      passed: false,
      failed: ['douleur-charge', 'apprehension'],
    })
  })

  it('calcule le ratio du hop test et tient compte des critères automatiques', () => {
    const answers = { 'hop-test': { right: 162, left: 175 }, 'attaques-sous-max': true }
    expect(evaluateTest(p2, answers, { 'lendemain-sauts': { ok: true, detail: '' } }).failed).toEqual([]) // 0,926
    expect(evaluateTest(p2, { ...answers, 'hop-test': { right: 150, left: 175 } }, { 'lendemain-sauts': { ok: true, detail: '' } }).failed).toEqual(['hop-test']) // 0,857
    expect(evaluateTest(p2, answers, { 'lendemain-sauts': { ok: false, detail: '' } }).failed).toEqual(['lendemain-sauts'])
  })
})

describe('phase en cours', () => {
  it('est la dernière entrée enregistrée, même si sa date de début a été reculée', () => {
    const events: PhaseEvent[] = [
      { id: 1, at: day(14, 8), phaseId: 'p0', reason: 'debut' },
      { id: 2, at: day(14, 9), phaseId: 'p3', reason: 'manuel' },
      { id: 3, at: day(11, 8), phaseId: 'p0', reason: 'manuel' },
    ]
    expect(currentEntry(events)?.id).toBe(3)
  })
})
