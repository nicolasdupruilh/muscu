import { useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router'
import { LineChart } from '../components/LineChart'
import { formatDone } from '../components/SetEntry'
import { legPrescription, legProgram, programShapes } from '../data'
import type { Exercise, Session, SetLog } from '../db/models'
import { abandonSession } from '../db/sessions'
import { useExercises, useSessions, useSetLogs } from '../hooks'
import { formatDay } from '../logic/dates'
import { formatRest } from '../logic/format'
import { kneeRule } from '../logic/knee'
import { positionOf } from '../logic/programs'
import { entryMode, parseReps, type EntryMode } from '../logic/reps'
import { exerciseHistory, kneeHistory, metricsFor, sessionSummary } from '../logic/stats'

export const typeLabels: Record<string, string> = {
  jambes: 'Jambes',
  push: 'Push',
  pull: 'Pull',
  abdos: 'Abdos',
  libre: 'Séance libre',
  course: 'Footing',
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const dayMonthYear = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
/** « 11 sept. », avec l'année seulement si ce n'est pas l'année en cours. */
const shortDate = { format: (d: Date) => (d.getFullYear() === new Date().getFullYear() ? dayMonth : dayMonthYear).format(d) }

function HistoryTabs() {
  return (
    <nav className="segmented">
      <NavLink to="/historique" end>
        Séances
      </NavLink>
      <NavLink to="/historique/exercices">Exercices</NavLink>
      <NavLink to="/historique/genou">Genou</NavLink>
    </nav>
  )
}

/** Titre d'une séance : « Jambes A · S3 », « Abdos · S2 », « Push ». */
function sessionTitle(s: Session): string {
  if (s.type === 'jambes' && s.program) {
    const p = s.prescription ?? positionOf(programShapes.jambes, s.program.index)
    return `Jambes ${p.label} · semaine ${p.week}`
  }
  if (s.type === 'abdos' && s.program) return `Abdos · semaine ${positionOf(programShapes.abdos, s.program.index).week}`
  return typeLabels[s.type] ?? s.type
}

export function Historique() {
  const sessions = useSessions()
  const logs = useSetLogs()
  if (!sessions || !logs) return null
  const done = sessions.filter((s) => s.status === 'terminee').reverse()

  return (
    <>
      <h1>Historique</h1>
      <HistoryTabs />
      {done.length === 0 ? (
        <p className="muted">Aucune séance pour l'instant.</p>
      ) : (
        <ul className="list card">
          {done.map((s) => {
            const sum = sessionSummary(s, logs)
            const knee = kneeRule(s.kneeCheck, legProgram.healthCheck.rules)
            return (
              <li key={s.id}>
                <Link className="history-row" to={`/historique/seance/${s.id}`}>
                  <span>
                    <strong>{sessionTitle(s)}</strong>
                    <span className="small muted">
                      {formatDay(new Date(s.date))}
                      {s.type !== 'course' && ` · ${plural(sum.exercises, 'exercice')} · ${plural(sum.sets, 'série')}`}
                      {sum.minutes && s.type !== 'course' ? ` · ${sum.minutes} min` : ''}
                    </span>
                  </span>
                  {knee && <span className={`badge knee-badge ${knee.level}`}>Genou {knee.level}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

const modeFor = (exercise: Exercise | undefined, s: SetLog, plannedReps?: string | number): EntryMode => {
  if (!exercise) return 'reps'
  if (plannedReps !== undefined) return entryMode(parseReps(plannedReps), exercise.loadUnit)
  if (s.reps === undefined && s.durationSec === undefined) return 'check'
  return exercise.loadUnit === 'time' ? 'time' : 'reps'
}

export function SeanceDetail() {
  const { id } = useParams()
  const sessions = useSessions()
  const logs = useSetLogs()
  const exercises = useExercises()
  const navigate = useNavigate()
  if (!sessions || !logs || !exercises) return null
  const s = sessions.find((x) => x.id === Number(id))
  if (!s) return <p>Séance introuvable.</p>

  const sum = sessionSummary(s, logs)
  const mine = logs.filter((l) => l.sessionId === s.id && l.done)
  const keys = (s.plan ?? []).map((p) => p.key).filter((k) => mine.some((l) => l.planKey === k))
  for (const l of mine) if (!keys.includes(l.planKey)) keys.push(l.planKey)
  const knee = kneeRule(s.kneeCheck, legProgram.healthCheck.rules)
  // Nom de la séance tel qu'il était prescrit le jour où elle a été faite.
  const legP = s.type === 'jambes' && s.program ? s.prescription ?? legPrescription(s.program.index) : undefined

  return (
    <>
      <p>
        <Link to="/historique">‹ Historique</Link>
      </p>
      <h1>{legP?.name || sessionTitle(s)}</h1>
      <p className="muted">
        {legP && `Semaine ${legP.week} · ${legP.blockName}${legP.deload ? ' (allégée)' : ''} · programme v${legP.programVersion} · `}
        {formatDay(new Date(s.date))}
        {sum.minutes ? ` · ${sum.minutes} min` : ''}
        {s.type !== 'course' && ` · ${plural(sum.sets, 'série')}`}
      </p>

      {s.kneeCheck && (
        <section className={`card knee ${knee?.level ?? ''}`}>
          <strong>Genou {knee?.level}</strong>
          <div className="small">
            Pendant : {s.kneeCheck.pendant ?? '–'}/10 · Lendemain : {s.kneeCheck.lendemain ?? 'pas encore répondu'}
            {s.kneeCheck.lendemain !== undefined && '/10'}
          </div>
          {knee && <div className="small muted">{knee.action}</div>}
        </section>
      )}

      {keys.map((key) => {
        const sets = mine.filter((l) => l.planKey === key).sort((a, b) => a.setNumber - b.setNumber)
        const planned = s.plan?.find((p) => p.key === key)
        const ex = exercises.get(sets[0].exerciseId)
        const unit = ex?.loadUnit ?? 'kg'
        return (
          <section key={key} className="card">
            <div className="row">
              <Link className="grow" to={`/historique/exercice/${sets[0].exerciseId}`}>
                <strong>{ex?.name ?? sets[0].exerciseId}</strong>
              </Link>
              {planned?.label && <span className="small muted">{planned.label}</span>}
            </div>
            <ul className="list">
              {sets.map((l) => {
                const mode = modeFor(ex, l, planned?.prescribedReps)
                const missed = l.targetReps !== undefined && mode !== 'check' && (mode === 'time' ? l.durationSec ?? 0 : l.reps ?? 0) < l.targetReps
                return (
                  <li key={l.id} className="set-detail">
                    <span className="muted">{s.type === 'abdos' ? 'Tour' : 'Série'} {l.setNumber}</span>
                    <strong>{formatDone(l, unit, mode)}</strong>
                    <span className="small muted">
                      {l.targetReps !== undefined && mode !== 'check' && (
                        <span className={missed ? 'warn-text' : ''}>
                          cible {l.targetLoadKg !== undefined ? `${l.targetLoadKg.toLocaleString('fr-FR')} kg × ` : ''}
                          {l.targetReps}
                        </span>
                      )}
                      {l.restTakenSec !== undefined && l.setNumber > 1 && ` · repos ${formatRest(l.restTakenSec)}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      <button
        className="link danger-text"
        style={{ marginTop: 16 }}
        onClick={async () => {
          if (!confirm('Supprimer définitivement cette séance et ses séries ?')) return
          await abandonSession(s.id!)
          navigate('/historique')
        }}
      >
        Supprimer cette séance
      </button>
    </>
  )
}

export function ExercicesHistorique() {
  const logs = useSetLogs()
  const sessions = useSessions()
  const exercises = useExercises()
  if (!logs || !sessions || !exercises) return null
  const done = new Set(sessions.filter((s) => s.status === 'terminee').map((s) => s.id))
  const last = new Map<string, { at: string; count: number }>()
  for (const l of logs) {
    if (!l.done || !done.has(l.sessionId)) continue
    const cur = last.get(l.exerciseId)
    last.set(l.exerciseId, { at: !cur || l.at > cur.at ? l.at : cur.at, count: (cur?.count ?? 0) + 1 })
  }
  const list = [...last.entries()].sort((a, b) => b[1].at.localeCompare(a[1].at))

  return (
    <>
      <h1>Historique</h1>
      <HistoryTabs />
      {list.length === 0 ? (
        <p className="muted">Aucun exercice fait pour l'instant.</p>
      ) : (
        <ul className="list card">
          {list.map(([id, info]) => (
            <li key={id}>
              <Link className="history-row" to={`/historique/exercice/${id}`}>
                <span>
                  <strong>{exercises.get(id)?.name ?? id}</strong>
                  <span className="small muted">
                    Dernière fois le {shortDate.format(new Date(info.at))} · {plural(info.count, 'série')} au total
                  </span>
                </span>
                <span aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function ExerciceDetail() {
  const { id } = useParams()
  const logs = useSetLogs()
  const sessions = useSessions()
  const exercises = useExercises()
  const [metricId, setMetricId] = useState<string>()
  if (!logs || !sessions || !exercises || !id) return null
  const ex = exercises.get(id)
  const unit = ex?.loadUnit ?? 'kg'
  const metrics = metricsFor(unit)
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0]
  const points = exerciseHistory(logs, sessions, id, metric)
  const fmt = (v: number) => `${v.toLocaleString('fr-FR')} ${metric.unit}`
  const mode = (l: SetLog): EntryMode => (l.reps === undefined && l.durationSec === undefined ? 'check' : unit === 'time' ? 'time' : 'reps')
  const best = points.reduce<number | undefined>((m, p) => (m === undefined || p.value > m ? p.value : m), undefined)

  return (
    <>
      <p>
        <Link to="/historique/exercices">‹ Exercices</Link>
      </p>
      <h1>{ex?.name ?? id}</h1>
      {best !== undefined && (
        <p className="muted">
          Record : <strong>{fmt(best)}</strong> ({metric.label})
        </p>
      )}

      {metrics.length > 1 && (
        <div className="chips">
          {metrics.map((m) => (
            <button key={m.id} className={`chip ${m.id === metric.id ? 'on' : ''}`} onClick={() => setMetricId(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      )}

      <section className="card">
        <h2>{metric.label} par séance</h2>
        <LineChart
          series={[
            {
              id: metric.id,
              label: metric.label,
              color: '--series-1',
              points: points.map((p) => ({ x: new Date(p.date).getTime(), y: p.value, detail: formatDone(p.best, unit, mode(p.best)) })),
            },
          ]}
          yFormat={(v) => v.toLocaleString('fr-FR')}
        />
        {metric.id === '1rm' && <p className="small muted">1RM estimé par la formule d’Epley, à partir de la meilleure série.</p>}
      </section>

      <section className="card">
        <h2>Séances</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Séries</th>
              <th className="num">{metric.label}</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.sessionId}>
                <td>
                  <Link to={`/historique/seance/${p.sessionId}`}>{shortDate.format(new Date(p.date))}</Link>
                </td>
                <td>{p.sets.map((s) => formatDone(s, unit, mode(s))).join(' · ')}</td>
                <td className="num">{fmt(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

export function GenouHistorique() {
  const sessions = useSessions()
  if (!sessions) return null
  const points = kneeHistory(sessions)
  const toPoints = (key: 'pendant' | 'lendemain') =>
    points.filter((p) => p[key] !== undefined).map((p) => ({ x: new Date(p.date).getTime(), y: p[key]! }))
  const rules = [...legProgram.healthCheck.rules].sort((a, b) => a.max - b.max)

  return (
    <>
      <h1>Historique</h1>
      <HistoryTabs />
      <section className="card">
        <h2>Douleur au genou</h2>
        <LineChart
          series={[
            { id: 'pendant', label: 'Pendant la séance', color: '--series-1', points: toPoints('pendant') },
            { id: 'lendemain', label: 'Le lendemain', color: '--series-2', points: toPoints('lendemain') },
          ]}
          yDomain={[0, 10]}
          yFormat={(v) => String(v)}
          yTicks={[0, 2, 4, 6, 8, 10]}
          refLines={rules.slice(0, -1).map((r) => ({ y: r.max, label: `${r.level} ≤ ${r.max}` }))}
        />
      </section>
      {points.length > 0 && (
        <section className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Séance</th>
                <th className="num">Pendant</th>
                <th className="num">Lendemain</th>
                <th>Feu</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => {
                const level = kneeRule({ pendant: p.pendant, lendemain: p.lendemain }, legProgram.healthCheck.rules)?.level
                return (
                  <tr key={p.sessionId}>
                    <td>
                      <Link to={`/historique/seance/${p.sessionId}`}>{shortDate.format(new Date(p.date))}</Link>
                    </td>
                    <td className="num">{p.pendant ?? '–'}</td>
                    <td className="num">{p.lendemain ?? '–'}</td>
                    <td>{level && <span className={`badge knee-badge ${level}`}>{level}</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}
