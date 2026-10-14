// Check genou : douleur pendant la séance (jambes ou volley), puis squat unipodal lent le lendemain matin.
// Le niveau (vert / orange / rouge) se décide sur la réponse du lendemain (healthCheck.decisionOn) ;
// sans decisionOn, sur le maximum des deux réponses (anciens programmes).

import type { HealthRule } from '../data/types'
import type { KneeCheck, Session } from '../db/models'
import { toLocalDate } from './dates'

export type KneeLevel = HealthRule['level']

export function kneeRule(check: KneeCheck | undefined, rules: HealthRule[], decisionOn?: 'lendemain'): HealthRule | undefined {
  const values = (decisionOn === 'lendemain' ? [check?.lendemain] : [check?.pendant, check?.lendemain]).filter(
    (v): v is number => v !== undefined,
  )
  if (values.length === 0) return undefined
  const worst = Math.max(...values)
  const sorted = [...rules].sort((a, b) => a.max - b.max)
  return sorted.find((r) => worst <= r.max) ?? sorted[sorted.length - 1]
}

/** Niveau d'une réponse du lendemain. */
export const levelOf = (value: number, rules: HealthRule[]) => kneeRule({ lendemain: value }, rules, 'lendemain')!.level

/** Séances concernées par le check genou (jambes et volley), terminées, avec une douleur « pendant ». */
export const checkedSessions = (sessions: Session[], appliesTo: string[] = ['jambes']) =>
  sessions
    .filter((s) => appliesTo.includes(s.type) && s.status === 'terminee' && s.kneeCheck?.pendant !== undefined)
    .sort((a, b) => (a.endedAt ?? a.date).localeCompare(b.endedAt ?? b.date))

/** Dernière séance terminée avec un check genou. */
export function lastKneeSession(sessions: Session[], appliesTo?: string[]): Session | undefined {
  const all = checkedSessions(sessions, appliesTo)
  return all[all.length - 1]
}

/** La question du lendemain est à poser : pas encore répondue, et on est au moins le lendemain de la séance. */
export function needsNextDayCheck(session: Session | undefined, now: Date): boolean {
  if (!session?.kneeCheck || session.kneeCheck.lendemain !== undefined) return false
  return toLocalDate(now) > toLocalDate(new Date(session.endedAt ?? session.date))
}

/** Séances qui attendent la réponse du lendemain (une seule réponse le matin vaut pour toutes). */
export const pendingNextDay = (sessions: Session[], now: Date, appliesTo?: string[]) =>
  checkedSessions(sessions, appliesTo).filter((s) => needsNextDayCheck(s, now))
