// Programme jambes par phases (v4) : position dans la phase, durée minimale, régressions, échelle volley,
// critères de sortie calculés, conditions des exercices optionnels, garde-fous sur les sauts.
//
// Les phases s'enchaînent sur critères, pas sur le calendrier. Le journal des phases (PhaseEvent) dit dans quelle
// phase on est et depuis quand ; seules les séances faites depuis cette entrée comptent pour la phase.

import type { ExitCriterion, HealthRule, LegPhase, LegProgramFile, LegSession, LegWeek } from '../data/types'
import type { CriterionAnswer, PhaseEvent, Session, SetLog } from '../db/models'
import { startOfWeek, toLocalDate } from './dates'

const DAY = 86_400_000

// ---------------------------------------------------------------------------------------------------------------
// Phases

export const phaseById = (program: LegProgramFile, id: string) => program.phases.find((p) => p.id === id)

/** Phase précédente (la première au minimum). */
export function previousPhaseId(program: LegProgramFile, id: string): string {
  const i = program.phases.findIndex((p) => p.id === id)
  return program.phases[Math.max(0, i - 1)].id
}

export function nextPhaseId(program: LegProgramFile, id: string): string | undefined {
  const i = program.phases.findIndex((p) => p.id === id)
  return program.phases[i + 1]?.id
}

/**
 * Entrée en cours : la dernière enregistrée dans le journal (par ordre d'enregistrement, pas par date :
 * reculer la date de début de la phase en cours ne doit pas faire revenir à une phase précédente).
 */
export function currentEntry(events: PhaseEvent[]): PhaseEvent | undefined {
  return [...events].sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).pop()
}

/** Séances d'une entrée de phase. */
const inEntry = (sessions: Session[], entry: PhaseEvent, types: string[]) =>
  sessions
    .filter((s) => types.includes(s.type) && s.status === 'terminee' && s.phase?.entryId === entry.id)
    .sort((a, b) => (a.endedAt ?? a.date).localeCompare(b.endedAt ?? b.date))

// ---------------------------------------------------------------------------------------------------------------
// Check genou dans la phase

export interface Check {
  sessionId: number
  type: string
  at: string
  pendant?: number
  lendemain?: number
}

/** Checks genou (jambes et volley) d'une entrée de phase, dans l'ordre. */
export function checksIn(sessions: Session[], entry: PhaseEvent, appliesTo: string[] = ['jambes', 'volley']): Check[] {
  return inEntry(sessions, entry, appliesTo)
    .filter((s) => s.kneeCheck)
    .map((s) => ({ sessionId: s.id!, type: s.type, at: s.endedAt ?? s.date, pendant: s.kneeCheck!.pendant, lendemain: s.kneeCheck!.lendemain }))
}

/** Seuils des règles : vert jusqu'à greenMax, orange jusqu'à orangeMax, rouge au-delà. */
export function thresholds(rules: HealthRule[]) {
  const max = (level: HealthRule['level']) => rules.find((r) => r.level === level)?.max
  return { greenMax: max('vert') ?? 2, orangeMax: max('orange') ?? 5 }
}

// ---------------------------------------------------------------------------------------------------------------
// Position dans la phase

/**
 * Charge ajoutée aux charges cibles à chaque répétition de la dernière semaine, si le lendemain est resté vert.
 * Source : règle de la phase 1 (« on répète la semaine 3 en ajoutant 2,5 kg tant que les critères de sortie ne sont
 * pas remplis » et « progression des charges uniquement si le lendemain reste à 2/10 ou moins »).
 */
export const REPEAT_LOAD_INCREMENT: Record<string, number> = { p1: 2.5 }

export interface PhasePosition {
  phase: LegPhase
  entry: PhaseEvent
  /** Semaine du programme dont on fait le contenu (absente en phase 0). */
  week?: number
  weekData?: LegWeek
  /** Semaine faite dans la phase, répétitions comprises (1, 2, 3, 4…). */
  instance: number
  /** Prochaine séance (A ou B). */
  label: string
  /** Séances déjà faites dans la semaine en cours. */
  doneLabels: string[]
  /** Labels de la semaine, dans l'ordre. */
  labels: string[]
  /** Pourquoi la semaine en cours reprend la précédente. */
  repeat?: 'orange' | 'derniere'
  loadBonusKg: number
  /** Semaines terminées dans cette entrée de phase. */
  weeksDone: number
  /** Toutes les semaines faites, sans répétition possible (fin du programme). */
  finished: boolean
  session?: LegSession
}

export function phasePosition(program: LegProgramFile, entry: PhaseEvent, sessions: Session[]): PhasePosition {
  const phase = phaseById(program, entry.phaseId) ?? program.phases[0]
  const legs = inEntry(sessions, entry, ['jambes'])

  // Phase 0 : séances fixes, sans semaines.
  if (!phase.weeks?.length) {
    const label = Object.keys(phase.sessions ?? {})[0] ?? 'A'
    return { phase, entry, instance: 1, label, labels: [label], doneLabels: [], loadBonusKg: 0, weeksDone: 0, finished: false, session: phase.sessions?.[label] }
  }

  const weeks = phase.weeks
  const labels = Object.keys(weeks[0].sessions)
  const make = (week: number, instance: number, doneLabels: string[], loadBonusKg: number, weeksDone: number, repeat?: PhasePosition['repeat']): PhasePosition => {
    const weekData = weeks.find((w) => w.week === week) ?? weeks[weeks.length - 1]
    const label = labels.find((l) => !doneLabels.includes(l)) ?? labels[0]
    return { phase, entry, week, weekData, instance, label, labels, doneLabels, repeat, loadBonusKg, weeksDone, finished: false, session: weekData.sessions[label] }
  }
  if (legs.length === 0) return make(weeks[0].week, 1, [], 0, 0)

  const last = legs[legs.length - 1].phase!
  const instance = last.instance ?? 1
  const week = last.week ?? weeks[0].week
  const bonus = last.loadBonusKg ?? 0
  const current = legs.filter((s) => (s.phase?.instance ?? 1) === instance)
  const doneLabels = [...new Set(current.map((s) => s.phase?.label).filter((l): l is string => !!l))]
  const completed = new Set(legs.map((s) => s.phase?.instance ?? 1)).size - (doneLabels.length < labels.length ? 1 : 0)
  if (doneLabels.length < labels.length) return make(week, instance, doneLabels, bonus, completed)

  // Semaine terminée : on refait la même si un lendemain de la semaine (jambes ou volley) est orange.
  const { greenMax, orangeMax } = thresholds(program.healthCheck.rules)
  const since = current[0].date
  const weekChecks = checksIn(sessions, entry).filter((c) => c.at >= since)
  const orange = weekChecks.some((c) => c.lendemain !== undefined && c.lendemain > greenMax && c.lendemain <= orangeMax)
  const allGreen = current.every((s) => s.kneeCheck?.lendemain !== undefined && s.kneeCheck.lendemain <= greenMax)
  if (orange) return make(week, instance + 1, [], bonus, completed, 'orange')
  const lastWeek = weeks[weeks.length - 1].week
  if (week < lastWeek) return make(week + 1, instance + 1, [], 0, completed)
  if (phase.repeatLastWeek) {
    const increment = allGreen ? (REPEAT_LOAD_INCREMENT[phase.id] ?? 0) : 0
    return make(week, instance + 1, [], bonus + increment, completed, 'derniere')
  }
  return { ...make(week, instance, doneLabels, bonus, completed), finished: true }
}

/** Jours calendaires depuis le début de la phase. */
export const daysInPhase = (entry: PhaseEvent, now: Date) =>
  Math.round((new Date(toLocalDate(now)).getTime() - new Date(toLocalDate(new Date(entry.at))).getTime()) / DAY)

/**
 * Durée minimale faite : en jours calendaires (phase 0), en semaines du programme terminées (phases 1 à 3,
 * répétitions comprises) pour ne jamais raccourcir une phase en sautant des séances.
 */
export function minDurationReached(pos: PhasePosition, now: Date): boolean {
  if (pos.phase.minDays !== undefined) return daysInPhase(pos.entry, now) >= pos.phase.minDays
  if (pos.phase.minWeeks !== undefined) return pos.weeksDone >= pos.phase.minWeeks
  return true
}

/** La phase dure plus longtemps que prévu (maxWeeks) : conseil de consulter. */
export const overMaxDuration = (pos: PhasePosition, now: Date) =>
  pos.phase.maxWeeks !== undefined && daysInPhase(pos.entry, now) > pos.phase.maxWeeks * 7

// ---------------------------------------------------------------------------------------------------------------
// Régressions

export interface Regression {
  to: string
  reason: string
}

/**
 * Régression après une réponse du lendemain (PRINCIPES.md, phaseRule) :
 * - au-dessus de 5/10 : phase précédente. Exception validée : en phase 3, un lendemain de volley au-dessus de 5
 *   fait redescendre l'échelle volley (voir volleyLadder) sans changer de phase ;
 * - au-dessus de 2/10 trois fois de suite : phase précédente ;
 * - phase 4 : retour en phase 3 si le lendemain dépasse 5/10 deux fois de suite (règle de la phase 4),
 *   ou au-dessus de 2/10 trois fois de suite.
 * Rien en phase 0 (pas de phase plus basse) : l'accueil conseille alors la kiné.
 */
export function regressionAfter(program: LegProgramFile, phaseId: string, checks: Check[]): Regression | undefined {
  if (phaseId === program.phases[0].id) return undefined
  const { greenMax, orangeMax } = thresholds(program.healthCheck.rules)
  const answered = checks.filter((c) => c.lendemain !== undefined)
  const last = answered[answered.length - 1]
  if (!last) return undefined
  const to = previousPhaseId(program, phaseId)
  const value = last.lendemain!
  const lastThree = answered.slice(-3)
  const threeAbove = lastThree.length === 3 && lastThree.every((c) => c.lendemain! > greenMax)
  const kind = last.type === 'volley' ? 'volley' : 'séance jambes'

  if (phaseId === 'p4') {
    const lastTwo = answered.slice(-2)
    if (lastTwo.length === 2 && lastTwo.every((c) => c.lendemain! > orangeMax)) return { to, reason: `lendemain au-dessus de ${orangeMax}/10 deux fois de suite` }
  } else if (value > orangeMax && !(phaseId === 'p3' && last.type === 'volley')) {
    return { to, reason: `lendemain à ${value}/10 après ${kind === 'volley' ? 'le volley' : 'la séance jambes'}` }
  }
  if (threeAbove) return { to, reason: `lendemain au-dessus de ${greenMax}/10 trois fois de suite` }
  return undefined
}

// ---------------------------------------------------------------------------------------------------------------
// Échelle volley (phase 3)

export interface LadderState {
  /** Marche du dernier volley. */
  current?: number
  /** Marche autorisée pour le prochain volley. */
  next: number
  /** Le lendemain du dernier volley n'est pas encore renseigné. */
  pending: boolean
  /** Lendemain du dernier volley au-dessus de 5 : pas de sauts en salle cette semaine. */
  noGymJumps: boolean
  reason: string
}

/** Une marche par séance de volley si le lendemain du précédent est vert ; même marche si orange ; deux de moins si rouge. */
export function volleyLadder(program: LegProgramFile, phase: LegPhase, sessions: Session[], entry: PhaseEvent, now: Date): LadderState {
  const steps = phase.volleyLadder ?? []
  const top = Math.max(1, ...steps.map((s) => s.step))
  const volleys = inEntry(sessions, entry, ['volley']).filter((s) => s.volley?.ladderStep !== undefined)
  const last = volleys[volleys.length - 1]
  if (!last) return { next: 1, pending: false, noGymJumps: false, reason: 'Premier volley de la phase : marche 1.' }
  const step = last.volley!.ladderStep!
  const value = last.kneeCheck?.lendemain
  if (value === undefined) return { current: step, next: step, pending: true, noGymJumps: false, reason: 'Réponds d’abord au check du lendemain du dernier volley.' }
  const { greenMax, orangeMax } = thresholds(program.healthCheck.rules)
  if (value <= greenMax) return { current: step, next: Math.min(top, step + 1), pending: false, noGymJumps: false, reason: `Lendemain à ${value}/10 : marche suivante.` }
  if (value <= orangeMax) return { current: step, next: step, pending: false, noGymJumps: false, reason: `Lendemain à ${value}/10 : même marche.` }
  const sameWeek = startOfWeek(new Date(last.endedAt ?? last.date)).getTime() === startOfWeek(now).getTime()
  return {
    current: step,
    next: Math.max(1, step - 2),
    pending: false,
    noGymJumps: sameWeek,
    reason: `Lendemain à ${value}/10 : deux marches plus bas${sameWeek ? ', et pas de sauts en salle cette semaine' : ''}.`,
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Critères de sortie calculés

export interface AutoResult {
  ok: boolean
  detail: string
}

export interface AutoContext {
  program: LegProgramFile
  entry: PhaseEvent
  sessions: Session[]
  logs: SetLog[]
  isJump: (exerciseId: string) => boolean
  now: Date
}

/** Une séance avec sauts : séance jambes où une série d'exercice de saut a été faite, ou volley avec sauts. */
export function hasJumps(s: Session, logs: SetLog[], isJump: (id: string) => boolean): boolean {
  if (s.type === 'volley') return (s.volley?.ladderStep ?? 2) >= 2 && (s.volley?.attacks ?? 1) > 0
  return logs.some((l) => l.sessionId === s.id && l.done && isJump(l.exerciseId))
}

const lendemainOk = (list: Session[], greenMax: number, what: string): AutoResult => {
  if (list.length === 0) return { ok: false, detail: `Aucune ${what} sur les 2 dernières semaines.` }
  const missing = list.filter((s) => s.kneeCheck?.lendemain === undefined).length
  const worst = Math.max(0, ...list.map((s) => s.kneeCheck?.lendemain ?? 0))
  if (missing) return { ok: false, detail: `${missing} ${what}${missing > 1 ? 's' : ''} sans réponse du lendemain.` }
  return worst <= greenMax
    ? { ok: true, detail: `${list.length} ${what}${list.length > 1 ? 's' : ''}, lendemain au plus ${worst}/10.` }
    : { ok: false, detail: `Lendemain jusqu’à ${worst}/10 sur les 2 dernières semaines.` }
}

/** Critères « auto » connus de l'appli. Un identifiant inconnu est signalé par le validateur des données. */
export const AUTO_CRITERIA: Record<string, (ctx: AutoContext) => AutoResult> = {
  'lendemain-2sem': ({ program, entry, sessions, now }) => {
    const since = new Date(now.getTime() - 14 * DAY).toISOString()
    const list = inEntry(sessions, entry, program.healthCheck.appliesTo ?? ['jambes']).filter((s) => (s.endedAt ?? s.date) >= since)
    return lendemainOk(list, thresholds(program.healthCheck.rules).greenMax, 'séance')
  },
  'lendemain-sauts': ({ program, entry, sessions, logs, isJump, now }) => {
    const since = new Date(now.getTime() - 14 * DAY).toISOString()
    const list = inEntry(sessions, entry, ['jambes', 'volley']).filter((s) => (s.endedAt ?? s.date) >= since && hasJumps(s, logs, isJump))
    return lendemainOk(list, thresholds(program.healthCheck.rules).greenMax, 'séance de sauts')
  },
  'volley-complet': ({ program, entry, sessions, now }) => {
    const { greenMax } = thresholds(program.healthCheck.rules)
    const volleys = inEntry(sessions, entry, ['volley'])
    const firstFull = volleys.findIndex((s) => (s.volley?.ladderStep ?? 0) >= 4)
    if (firstFull < 0) return { ok: false, detail: 'Pas encore de volley à la marche 4.' }
    const since = volleys.slice(firstFull)
    const days = Math.floor((now.getTime() - new Date(since[0].endedAt ?? since[0].date).getTime()) / DAY)
    const bad = since.filter((s) => s.kneeCheck?.lendemain === undefined || s.kneeCheck.lendemain > greenMax)
    if (bad.length) return { ok: false, detail: `${bad.length} volley${bad.length > 1 ? 's' : ''} depuis la marche 4 sans lendemain à ${greenMax}/10 ou moins.` }
    if (since.some((s) => (s.volley?.ladderStep ?? 0) < 4)) return { ok: false, detail: 'Redescendu sous la marche 4 depuis.' }
    return days >= 14 ? { ok: true, detail: `Marche 4 tenue depuis ${days} jours.` } : { ok: false, detail: `Marche 4 tenue depuis ${days} jours sur 14.` }
  },
}

// ---------------------------------------------------------------------------------------------------------------
// Conditions des exercices optionnels : « semaine>=2 », « semaine>=2 et lendemain<=2 »

export interface ConditionClause {
  variable: 'semaine' | 'lendemain'
  op: '>=' | '<=' | '>' | '<' | '='
  value: number
}

export function parseCondition(text: string): ConditionClause[] | undefined {
  const clauses = text.split(/\s+et\s+/).map((part) => part.trim().match(/^(semaine|lendemain)\s*(>=|<=|>|<|=)\s*(\d+(?:[.,]\d+)?)$/))
  if (clauses.some((m) => !m)) return undefined
  return clauses.map((m) => ({ variable: m![1] as ConditionClause['variable'], op: m![2] as ConditionClause['op'], value: Number(m![3].replace(',', '.')) }))
}

/** Valeurs connues : semaine de la phase, dernière réponse du lendemain (absente = condition non remplie). */
export function conditionMet(text: string, values: { semaine?: number; lendemain?: number }): boolean {
  const clauses = parseCondition(text)
  if (!clauses) return false
  return clauses.every((c) => {
    const v = values[c.variable]
    if (v === undefined) return false
    return c.op === '>=' ? v >= c.value : c.op === '<=' ? v <= c.value : c.op === '>' ? v > c.value : c.op === '<' ? v < c.value : v === c.value
  })
}

/** « semaine>=2 et lendemain<=2 » → « si semaine ≥ 2 et lendemain ≤ 2/10 ». */
export function describeCondition(text: string): string {
  const clauses = parseCondition(text)
  if (!clauses) return `si ${text}`
  const op = { '>=': '≥', '<=': '≤', '>': '>', '<': '<', '=': '=' }
  return 'si ' + clauses.map((c) => `${c.variable} ${op[c.op]} ${c.value}${c.variable === 'lendemain' ? '/10' : ''}`).join(' et ')
}

// ---------------------------------------------------------------------------------------------------------------
// Garde-fous sur les sauts

/**
 * Raison de ne pas faire de sauts aujourd'hui (les exercices de saut sont alors sautés par défaut, réactivables) :
 * - phase 2 : déjà 2 séances avec sauts cette semaine, ou une hier ;
 * - phase 3 : volley il y a moins de 48 h, ou lendemain du dernier volley au-dessus de 5/10 cette semaine.
 */
export function jumpGuard(ctx: AutoContext, phase: LegPhase, ladder?: LadderState): string | undefined {
  const { sessions, logs, isJump, now } = ctx
  const done = sessions.filter((s) => s.status === 'terminee')
  if (phase.id === 'p2') {
    const jumpy = done.filter((s) => hasJumps(s, logs, isJump))
    const thisWeek = jumpy.filter((s) => startOfWeek(new Date(s.date)).getTime() === startOfWeek(now).getTime())
    const yesterday = toLocalDate(new Date(now.getTime() - DAY))
    if (thisWeek.length >= 2) return 'Déjà 2 séances avec sauts cette semaine : pas de sauts aujourd’hui.'
    if (jumpy.some((s) => toLocalDate(new Date(s.date)) === yesterday)) return 'Séance avec sauts hier : jamais deux jours de suite.'
  }
  if (phase.id === 'p3') {
    if (ladder?.noGymJumps) return 'Lendemain du dernier volley au-dessus de 5/10 : pas de sauts en salle cette semaine.'
    const recent = done.find((s) => s.type === 'volley' && now.getTime() - new Date(s.endedAt ?? s.date).getTime() < 48 * 3600_000)
    if (recent) return 'Volley il y a moins de 48 h : pas de sauts en salle aujourd’hui.'
  }
  return undefined
}

// ---------------------------------------------------------------------------------------------------------------
// Test de sortie

/** Réponse valable pour un critère : échelle ≤ max, oui, ratio droite ÷ gauche ≥ min, ou critère calculé rempli. */
export function criterionPassed(c: ExitCriterion, answer: CriterionAnswer | undefined, auto?: AutoResult): boolean {
  const type = c.type ?? 'scale'
  if (type === 'auto') return !!auto?.ok
  if (answer === undefined) return false
  if (type === 'yesno') return answer === true
  if (type === 'ratio') {
    if (typeof answer !== 'object' || !(answer.left > 0)) return false
    return answer.right / answer.left >= (c.min ?? 1)
  }
  return typeof answer === 'number' && answer <= (c.max ?? 10)
}

export function evaluateTest(criteria: ExitCriterion[], answers: Record<string, CriterionAnswer>, auto: Record<string, AutoResult>) {
  const failed = criteria.filter((c) => !criterionPassed(c, answers[c.id], auto[c.id])).map((c) => c.id)
  return { passed: criteria.length > 0 && failed.length === 0, failed }
}
