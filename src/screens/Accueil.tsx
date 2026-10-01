import { Link } from 'react-router'
import { legWeek, programShapes } from '../data'
import { db } from '../db/db'
import { logFooting } from '../db/queries'
import { useActiveSession, useProgramStatus, useSessions } from '../hooks'
import { formatDay, isSameWeek } from '../logic/dates'
import { nextUpperType } from '../logic/upperBody'
import { ProgramWeek } from '../components/ProgramWeek'
import { StartUpperButton } from '../components/StartUpperButton'

export function Accueil() {
  const sessions = useSessions()
  const active = useActiveSession()
  const legs = useProgramStatus('jambes')
  const abs = useProgramStatus('abdos')
  if (!sessions || !legs || !abs || active === undefined) return null

  const now = new Date()
  const footings = sessions.filter((s) => s.type === 'course' && isSameWeek(new Date(s.date), now))
  const upper = nextUpperType(sessions)
  const legsWeek = legs.next && legWeek(legs.next.week)

  return (
    <>
      <h1>Aujourd'hui</h1>
      <p className="muted">{formatDay(now)}</p>

      {active && (
        <Link className="card resume" to="/seance">
          <strong>Séance en cours : {active.type === 'push' ? 'Push' : active.type === 'pull' ? 'Pull' : active.type}</strong>
          <span className="btn primary">Reprendre</span>
        </Link>
      )}

      <section className="card">
        <div className="row">
          <h2 className="grow">Jambes</h2>
          {legsWeek?.deload && <span className="badge warn">Semaine allégée</span>}
        </div>
        {legs.finished || !legs.next ? (
          <p>Programme de 16 semaines terminé.</p>
        ) : (
          <>
            <p className="muted">
              Semaine {legs.next.week} / {programShapes.jambes.weeksCount} · {legsWeek?.blockName}
            </p>
            <ProgramWeek status={legs} labelOf={(p) => `Séance ${p.label}`} detailOf={(p) => legWeek(p.week)?.sessions[p.label]?.name} />
            <Link className="btn primary block" to={`/seance/jambes/${legs.next.index}`} style={{ marginTop: 12 }}>
              Démarrer la séance {legs.next.label}
            </Link>
          </>
        )}
      </section>

      <section className="card">
        <h2>Haut du corps</h2>
        <p className="muted">
          Prochaine : <strong>{upper === 'push' ? 'Push' : 'Pull'}</strong>
          {abs.next && ` · puis abdos, semaine ${abs.next.week} (${abs.next.label} séance)`}
        </p>
        <div className="row">
          <StartUpperButton type="push" primary={upper === 'push'} />
          <StartUpperButton type="pull" primary={upper === 'pull'} />
        </div>
      </section>

      <section className="card">
        <div className="row">
          <h2 className="grow">Footing</h2>
          <span className={`badge ${footings.length ? 'ok' : ''}`}>
            {footings.length === 0 ? 'Pas encore cette semaine' : `${footings.length} cette semaine`}
          </span>
        </div>
        <button className="btn block" onClick={() => logFooting()}>
          Footing fait ✓
        </button>
        {footings.length > 0 && (
          <button className="link" onClick={() => db.sessions.delete(footings[footings.length - 1].id!)}>
            Annuler le dernier
          </button>
        )}
      </section>

      <p style={{ marginTop: 16 }}>
        <Link to="/seance">Choisir une autre séance</Link>
      </p>
    </>
  )
}
