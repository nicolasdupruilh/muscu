import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { restEndAlarm } from '../alarm'
import { db } from '../db/db'
import type { Session } from '../db/models'
import { adjustRest, endRest } from '../db/sessions'
import { formatRest } from '../logic/format'
import { formatClock, REST_STEP, remainingMs } from '../logic/rest'
import { circuitNext } from '../logic/structuredPlans'

/** Heure courante, rafraîchie plusieurs fois par seconde. */
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [active])
  return now
}

/** Ce qui vient après le repos : « Tractions, série 2 », ou l'exercice suivant. */
function useNextLabel(session: Session): string | undefined {
  return useLiveQuery(async () => {
    const plan = session.plan ?? []
    const logs = await db.setLogs.where('sessionId').equals(session.id!).toArray()
    const count = (key: string) => logs.filter((l) => l.planKey === key).length
    const names = new Map((await db.exercises.bulkGet(plan.map((p) => p.exerciseId))).map((e) => [e?.id, e?.name]))
    if (session.type === 'abdos') {
      const n = circuitNext(plan, count)
      const p = n && plan.find((x) => x.key === n.key)
      return p && `Tour ${n.round} : ${names.get(p.exerciseId)}`
    }
    const current = plan.find((p) => p.key === session.rest?.planKey)
    if (current && !current.skipped && count(current.key) < current.sets) {
      return `${names.get(current.exerciseId)}, série ${count(current.key) + 1}`
    }
    const next = plan.find((p) => !p.skipped && count(p.key) < p.sets)
    return next && `${names.get(next.exerciseId)}, série ${count(next.key) + 1}`
  }, [session])
}

/** Chrono de repos de la séance en cours : en grand, ou réduit en bandeau. */
export function RestTimer({ session }: { session: Session }) {
  const rest = session.rest
  const running = !!rest && !rest.endedAt
  const now = useNow(running)
  const [minimized, setMinimized] = useState(false)
  const alerted = useRef<string | undefined>(undefined)
  const next = useNextLabel(session)

  const left = rest ? remainingMs(rest.endsAt, now) : 0
  const total = rest ? new Date(rest.endsAt).getTime() - new Date(rest.startedAt).getTime() : 1

  // Un nouveau repos s'affiche en grand.
  useEffect(() => {
    setMinimized(false)
  }, [rest?.startedAt])

  // Signal de fin, une seule fois par repos, et seulement s'il vient de se terminer (pas au retour une heure après).
  useEffect(() => {
    if (!running || !rest || left > 0 || alerted.current === rest.startedAt) return
    alerted.current = rest.startedAt
    if (left > -60_000) restEndAlarm(next ? `À toi : ${next}` : 'À toi !')
  }, [running, rest, left, next])

  if (!running || !rest) return null
  const over = left <= 0
  const id = session.id!

  if (minimized) {
    return (
      <button className={`rest-bar ${over ? 'over' : ''}`} onClick={() => setMinimized(false)}>
        <span>Repos</span>
        <strong>{formatClock(left)}</strong>
        <span className="small">Agrandir</span>
      </button>
    )
  }

  return (
    <div className={`rest-overlay ${over ? 'over' : ''}`} role="timer" aria-live="polite">
      <div className="rest-top">
        <span className="muted">Repos · {formatRest(Math.round(total / 1000))}</span>
        <button className="link" onClick={() => setMinimized(true)}>
          Réduire
        </button>
      </div>
      <div className="rest-clock">{formatClock(left)}</div>
      <div className="rest-progress">
        <div style={{ width: `${Math.min(100, Math.max(0, (1 - left / total) * 100))}%` }} />
      </div>
      {next && <p className="rest-next">{over ? 'À toi : ' : 'Ensuite : '}{next}</p>}
      <div className="rest-buttons">
        <button className="btn" onClick={() => adjustRest(id, -REST_STEP)}>
          −{REST_STEP} s
        </button>
        <button className="btn" onClick={() => adjustRest(id, REST_STEP)}>
          +{REST_STEP} s
        </button>
      </div>
      <button className="btn primary block big" onClick={() => endRest(id)}>
        {over ? "C'est parti" : 'Passer'}
      </button>
    </div>
  )
}
