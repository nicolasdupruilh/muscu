// Actions du programme jambes par phases : démarrer une séance de phase, volley, isométriques du jour,
// réponse du lendemain (avec régression automatique), test de sortie, changement de phase à la main.
import { legPhase, legPrescription, legProgram } from '../data'
import { toLocalDate } from '../logic/dates'
import { checkedSessions } from '../logic/knee'
import {
  AUTO_CRITERIA,
  checksIn,
  currentEntry,
  evaluateTest,
  jumpGuard,
  nextPhaseId,
  phasePosition,
  regressionAfter,
  volleyLadder,
  type AutoContext,
  type AutoResult,
  type Regression,
} from '../logic/phases'
import { buildPhasePlan } from '../logic/structuredPlans'
import { db, type AppDB } from './db'
import type { CriterionAnswer, PhaseEvent, Session } from './models'
import { activeSession } from './sessions'

const appliesTo = legProgram.healthCheck.appliesTo ?? ['jambes']

/** Tout ce qu'il faut pour raisonner sur la phase en cours. */
export async function phaseContext(database: AppDB = db, now = new Date()): Promise<AutoContext> {
  const [events, sessions, logs, plyo] = await Promise.all([
    database.phaseEvents.toArray(),
    database.sessions.toArray(),
    database.setLogs.toArray(),
    database.exercises.where('category').equals('plyo').primaryKeys(),
  ])
  const entry = currentEntry(events) ?? { id: 0, at: now.toISOString(), phaseId: legProgram.phases[0].id, reason: 'debut' as const }
  const jumps = new Set(plyo as string[])
  return { program: legProgram, entry, sessions, logs, isJump: (id) => jumps.has(id), now }
}

/** Dernière réponse du lendemain connue (jambes ou volley), pour les conditions « lendemain<=2 ». */
export function lastLendemain(sessions: Session[]): number | undefined {
  const answered = checkedSessions(sessions, appliesTo).filter((s) => s.kneeCheck?.lendemain !== undefined)
  return answered[answered.length - 1]?.kneeCheck?.lendemain
}

/** Variante d'une liste par son identifiant ; à défaut, la complète (la dernière). */
const variantById = <V extends { id: string }>(variants: V[], id?: string): V => variants.find((v) => v.id === id) ?? variants[variants.length - 1]

/** Démarre la prochaine séance jambes de la phase en cours, dans la variante choisie (ou renvoie la séance en cours). */
export async function startLegSession(variantId?: string, database: AppDB = db, now = new Date()): Promise<number> {
  const ctx = await phaseContext(database, now)
  return database.transaction('rw', database.sessions, async () => {
    const current = await activeSession(database)
    if (current) return current.id!
    const pos = phasePosition(legProgram, ctx.entry, ctx.sessions)
    if (pos.finished || !pos.session) throw new Error('Programme jambes terminé')
    const variant = variantById(pos.session.variants, variantId)
    const ladder = pos.phase.volleyLadder ? volleyLadder(legProgram, pos.phase, ctx.sessions, ctx.entry, now) : undefined
    const { plan, hidden } = buildPhasePlan(variant.items, {
      week: pos.week,
      lendemain: lastLendemain(ctx.sessions),
      loadBonusKg: pos.loadBonusKg,
      jumpNote: jumpGuard(ctx, pos.phase, ladder),
      isJump: ctx.isJump,
    })
    return (await database.sessions.add({
      date: now.toISOString(),
      type: 'jambes',
      status: 'en-cours',
      phase: { entryId: ctx.entry.id!, phaseId: pos.phase.id, week: pos.week, instance: pos.instance, label: pos.label, loadBonusKg: pos.loadBonusKg },
      prescription: legPrescription(pos),
      variant: { id: variant.id, label: variant.label, estimatedMin: variant.estimatedMin },
      plan,
      ...(hidden.length && { hiddenOptional: hidden }),
    })) as number
  })
}

export interface VolleyInput {
  /** Jour du volley (l'heure est celle de la saisie si c'est aujourd'hui, 20 h sinon). */
  day: string
  durationMin: number
  ladderStep?: number
  attacks?: number
  /** Douleur pendant, le maximum (0 à 10). */
  pendant: number
}

/** Enregistre une séance de volley, avec la douleur pendant ; la question du lendemain sera posée le matin suivant. */
export async function logVolley(input: VolleyInput, database: AppDB = db, now = new Date()): Promise<number> {
  const ctx = await phaseContext(database, now)
  const [y, m, d] = input.day.split('-').map(Number)
  const end = input.day === toLocalDate(now) ? now : new Date(y, m - 1, d, 20)
  const start = new Date(end.getTime() - input.durationMin * 60_000)
  return (await database.sessions.add({
    date: start.toISOString(),
    endedAt: end.toISOString(),
    type: 'volley',
    status: 'terminee',
    phase: { entryId: ctx.entry.id!, phaseId: ctx.entry.phaseId },
    volley: { durationMin: input.durationMin, ladderStep: input.ladderStep, attacks: input.attacks },
    kneeCheck: { pendant: input.pendant },
  })) as number
}

/** Isométriques du jour faits (ou annulés). */
export async function setIsoDone(done: boolean, database: AppDB = db, now = new Date()) {
  const today = toLocalDate(now)
  const ctx = await phaseContext(database, now)
  await database.transaction('rw', database.sessions, async () => {
    const existing = (await database.sessions.where('type').equals('iso').toArray()).filter((s) => toLocalDate(new Date(s.date)) === today)
    if (done && existing.length === 0) {
      await database.sessions.add({ date: now.toISOString(), endedAt: now.toISOString(), type: 'iso', status: 'terminee', phase: { entryId: ctx.entry.id!, phaseId: ctx.entry.phaseId } })
    }
    if (!done) await database.sessions.bulkDelete(existing.map((s) => s.id!))
  })
}

/**
 * Réponse du matin (squat unipodal lent), pour toutes les séances qui l'attendent. Puis régression automatique
 * si la règle s'applique : la phase précédente commence maintenant. Renvoie la régression éventuelle.
 */
export async function saveNextDay(sessionIds: number[], lendemain: number, database: AppDB = db, now = new Date()): Promise<Regression | undefined> {
  await database.transaction('rw', database.sessions, async () => {
    for (const id of sessionIds) {
      const s = await database.sessions.get(id)
      if (s) await database.sessions.update(id, { kneeCheck: { ...s.kneeCheck, lendemain, lendemainAt: now.toISOString() } })
    }
  })
  const ctx = await phaseContext(database, now)
  const regression = regressionAfter(legProgram, ctx.entry.phaseId, checksIn(ctx.sessions, ctx.entry, appliesTo))
  if (regression) {
    await database.phaseEvents.add({ at: now.toISOString(), phaseId: regression.to, reason: 'regression', note: regression.reason })
  }
  return regression
}

/** Critères calculés de la phase en cours. */
export function autoResults(ctx: AutoContext): Record<string, AutoResult> {
  const phase = legPhase(ctx.entry.phaseId)
  return Object.fromEntries(
    (phase?.exitCriteria ?? [])
      .filter((c) => c.type === 'auto')
      .map((c) => [c.id, AUTO_CRITERIA[c.id]?.(ctx) ?? { ok: false, detail: 'Critère que l’appli ne sait pas calculer.' }]),
  )
}

/** Enregistre un test de sortie ; s'il est réussi, la phase suivante commence maintenant. */
export async function submitPhaseTest(answers: Record<string, CriterionAnswer>, database: AppDB = db, now = new Date()) {
  const ctx = await phaseContext(database, now)
  const phase = legPhase(ctx.entry.phaseId)!
  const { passed, failed } = evaluateTest(phase.exitCriteria ?? [], answers, autoResults(ctx))
  const next = passed ? nextPhaseId(legProgram, phase.id) : undefined
  await database.transaction('rw', database.phaseTests, database.phaseEvents, async () => {
    await database.phaseTests.add({ at: now.toISOString(), phaseId: phase.id, answers, passed, failed })
    if (next) await database.phaseEvents.add({ at: now.toISOString(), phaseId: next, reason: 'test' })
  })
  return { passed, failed, next }
}

/** Correction à la main : la phase choisie commence maintenant. */
export async function setPhaseManually(phaseId: string, database: AppDB = db, now = new Date()) {
  await database.phaseEvents.add({ at: now.toISOString(), phaseId, reason: 'manuel' })
}

/** Change la date de début de la phase en cours (AAAA-MM-JJ). */
export async function setCurrentPhaseStart(day: string, database: AppDB = db) {
  const entry = currentEntry(await database.phaseEvents.toArray())
  if (!entry) return
  const [y, m, d] = day.split('-').map(Number)
  await database.phaseEvents.update(entry.id!, { at: new Date(y, m - 1, d, 8).toISOString() })
}

export type { PhaseEvent }
