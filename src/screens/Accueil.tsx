import { Link, useNavigate } from 'react-router'
import { KneeScale } from '../components/KneeScale'
import { legProgram, legProgramVersion, legWeek, programShapes, upperBody } from '../data'
import { db, updateSettings } from '../db/db'
import { logFooting } from '../db/queries'
import { saveKneeNextDay } from '../db/sessions'
import { kneeRule, lastKneeSession, needsNextDayCheck } from '../logic/knee'
import { useActiveSession, useProgramStatus, useSessions, useSettings } from '../hooks'
import { formatDay, isSameWeek } from '../logic/dates'
import { nextUpperType } from '../logic/upperBody'
import { ProgramWeek } from '../components/ProgramWeek'
import { StartUpperButton } from '../components/StartUpperButton'

export function Accueil() {
  const sessions = useSessions()
  const active = useActiveSession()
  const legs = useProgramStatus('jambes')
  const abs = useProgramStatus('abdos')
  const navigate = useNavigate()
  const settings = useSettings()
  if (!sessions || !legs || !abs || active === undefined || !settings) return null

  const now = new Date()
  const footings = sessions.filter((s) => s.type === 'course' && isSameWeek(new Date(s.date), now))
  const upper = nextUpperType(sessions)
  const legsWeek = legs.next && legWeek(legs.next.week)
  const kneeSession = lastKneeSession(sessions)
  const kneeStatus = kneeRule(kneeSession?.kneeCheck, legProgram.healthCheck.rules)
  const askNextDay = needsNextDayCheck(kneeSession, now)
  // Annonce d'une nouvelle version du programme, une seule fois, si j'ai déjà fait des séances avec l'ancienne.
  const programUpdated =
    legProgramVersion > (settings.seenLegProgramVersion ?? 1) &&
    sessions.some((s) => s.type === 'jambes' && (s.prescription?.programVersion ?? 1) < legProgramVersion)

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

      {programUpdated && (
        <section className="card update">
          <h2>Programmes mis à jour</h2>
          {[...(legProgram.changelog ?? []).slice(-1), ...(upperBody.changelog ?? []).slice(-1).map((l) => `Haut du corps ${l}`)].map((line) => (
            <p key={line} className="small">
              {line}
            </p>
          ))}
          <p className="small muted">Tes séances déjà faites gardent ce qui était prescrit à l’époque.</p>
          <button className="btn block" onClick={() => updateSettings((s) => ({ ...s, seenLegProgramVersion: legProgramVersion }))}>
            Compris
          </button>
        </section>
      )}

      {askNextDay && kneeSession && (
        <section className="card">
          <h2>Genou : check du matin</h2>
          <p>{legProgram.healthCheck.questions.find((q) => q.id === 'lendemain')?.label}, douleur de 0 à 10 :</p>
          <KneeScale onPick={(v) => saveKneeNextDay(kneeSession.id!, v)} />
        </section>
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
            {kneeStatus && !askNextDay && (
              <div className={`knee-line ${kneeStatus.level}`}>
                <strong>Genou {kneeStatus.level}</strong> · {kneeStatus.action}
              </div>
            )}
            <button
              className="btn primary block"
              style={{ marginTop: 12 }}
              onClick={() => navigate('/demarrer/jambes')}
            >
              Démarrer la séance {legs.next.label}
            </button>
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
