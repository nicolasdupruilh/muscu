// Check genou du programme jambes : douleur pendant la séance, puis squat unipodal le lendemain matin.
// Le niveau (vert / orange / rouge) se calcule sur le maximum des réponses, selon healthCheck.rules.

import type { HealthRule } from '../data/types'
import type { KneeCheck, Session } from '../db/models'
import { toLocalDate } from './dates'

export type KneeLevel = HealthRule['level']

export function kneeRule(check: KneeCheck | undefined, rules: HealthRule[]): HealthRule | undefined {
  const values = [check?.pendant, check?.lendemain].filter((v): v is number => v !== undefined)
  if (values.length === 0) return undefined
  const worst = Math.max(...values)
  const sorted = [...rules].sort((a, b) => a.max - b.max)
  return sorted.find((r) => worst <= r.max) ?? sorted[sorted.length - 1]
}

/** Dernière séance jambes terminée avec un check genou. */
export function lastKneeSession(sessions: Session[]): Session | undefined {
  return sessions
    .filter((s) => s.type === 'jambes' && s.status === 'terminee' && s.kneeCheck?.pendant !== undefined)
    .reduce<Session | undefined>((a, b) => (!a || (b.endedAt ?? b.date) > (a.endedAt ?? a.date) ? b : a), undefined)
}

/** La question du lendemain est à poser : pas encore répondue, et on est au moins le lendemain de la séance. */
export function needsNextDayCheck(session: Session | undefined, now: Date): boolean {
  if (!session?.kneeCheck || session.kneeCheck.lendemain !== undefined) return false
  return toLocalDate(now) > toLocalDate(new Date(session.endedAt ?? session.date))
}
