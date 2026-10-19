import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { KneeScale } from '../components/KneeScale'
import { StartUpperButton } from '../components/StartUpperButton'
import { legPhase, legProgram, legProgramVersion, upperBody } from '../data'
import { db, updateSettings } from '../db/db'
import type { Session } from '../db/models'
import { saveNextDay, setIsoDone } from '../db/phases'
import { startAbsSession } from '../db/sessions'
import { logFooting } from '../db/queries'
import { useActiveSession, usePhase, useProgramStatus, useSessions, useSetLogs, useSettings } from '../hooks'
import { formatDay, isSameWeek, toLocalDate } from '../logic/dates'
import { checkedSessions, kneeRule, pendingNextDay } from '../logic/knee'
import { nextUpperType } from '../logic/upperBody'
import { addDailyReminder, dailyOf, REMINDER_HOUR } from './Iso'

const typeNames: Record<string, string> = { push: 'Push', pull: 'Pull', jambes: 'Jambes', abdos: 'Abdos', volley: 'Volley' }
const shortDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
const appliesTo = legProgram.healthCheck.appliesTo ?? ['jambes']

export function Accueil() {
  const sessions = useSessions()
  const logs = useSetLogs()
  const active = useActiveSession()
  const phase = usePhase()
  const abs = useProgramStatus('abdos')
  const settings = useSettings()
  const navigate = useNavigate()
  const [reminder, setReminder] = useState<string>()

  const now = new Date()
  const today = toLocalDate(now)
  const daily = phase && phase.pos.phase.daily ? dailyOf(phase.pos.phase.daily)[0] : undefined
  // Isométriques faits aujourd'hui : cochés, ou les tenues faites dans une séance jambes du jour.
  const isoDone =
    !!sessions &&
    !!logs &&
    (sessions.some((s) => s.type === 'iso' && toLocalDate(new Date(s.date)) === today) ||
      (!!daily &&
        logs.filter((l) => l.done && l.exerciseId === daily.exerciseId && toLocalDate(new Date(l.at)) === today).length >= daily.sets))

  // Pastille sur l'icône de l'appli tant que les isométriques du jour ne sont pas faits (quand iOS le permet).
  useEffect(() => {
    if (!daily) return
    if (isoDone) void navigator.clearAppBadge?.().catch(() => {})
    else void navigator.setAppBadge?.(1).catch(() => {})
  }, [daily, isoDone])

  if (!sessions || !logs || !phase || !abs || active === undefined || !settings) return null

  const footings = sessions.filter((s) => s.type === 'course' && isSameWeek(new Date(s.date), now))
  const absThisWeek = sessions.filter((s) => s.type === 'abdos' && s.status === 'terminee' && isSameWeek(new Date(s.date), now)).length
  const upper = nextUpperType(sessions)
  const { pos, ladder, events } = phase
  const rules = legProgram.healthCheck.rules
  const pending = pendingNextDay(sessions, now, appliesTo)
  const lastAnswered = checkedSessions(sessions, appliesTo)
    .filter((s) => s.kneeCheck?.lendemain !== undefined)
    .pop()
  const knee = kneeRule(lastAnswered?.kneeCheck, rules, legProgram.healthCheck.decisionOn)
  const lastEvent = events[events.length - 1]
  const legsSinceEvent = sessions.some((s) => s.type === 'jambes' && s.phase?.entryId === lastEvent?.id && s.status === 'terminee')
  const programUpdated =
    legProgramVersion > (settings.seenLegProgramVersion ?? 1) &&
    sessions.some((s) => s.type === 'jambes' && (s.prescription?.programVersion ?? 1) < legProgramVersion)
  const phaseShort = pos.phase.name.split(' :')[0]
  const legsThisWeek = sessions.filter((s) => s.type === 'jambes' && s.status === 'terminee' && s.phase?.entryId === pos.entry.id && isSameWeek(new Date(s.date), now)).length
  const describe = (s: Session) => `${s.type === 'volley' ? 'le volley' : 'la séance jambes'} du ${shortDay.format(new Date(s.date))}`

  return (
    <>
      <h1>Aujourd'hui</h1>
      <p className="muted">{formatDay(now)}</p>

      {active && (
        <Link className="card resume" to="/seance">
          <strong>Séance en cours : {typeNames[active.type] ?? active.type}</strong>
          <span className="btn primary">Reprendre</span>
        </Link>
      )}

      {lastEvent?.reason === 'regression' && !legsSinceEvent && (
        <section className="card knee rouge">
          <strong>Retour en {legPhase(lastEvent.phaseId)?.name}</strong>
          <p className="small">Raison : {lastEvent.note}.</p>
          <p className="small">{rules.find((r) => r.level === 'rouge')?.action}</p>
        </section>
      )}

      {pending.length > 0 && (
        <section className="card">
          <h2>Genou : check du matin</h2>
          <p>
            {legProgram.healthCheck.questions.find((q) => q.id === 'lendemain')?.label}, après {pending.map(describe).join(' et ')} : douleur de 0 à 10.
          </p>
          <KneeScale onPick={(v) => void saveNextDay(pending.map((s) => s.id!), v)} />
        </section>
      )}

      {programUpdated && (
        <section className="card update">
          <h2>Programmes mis à jour</h2>
          {[...(legProgram.changelog ?? []).slice(-1), ...(upperBody.changelog ?? []).slice(-1).map((l) => `Haut du corps ${l}`)].map((line) => (
            <p key={line} className="small">
              {line}
            </p>
          ))}
          <p className="small muted">Tes séances déjà faites gardent ce qui était prescrit à l’époque, et restent dans l’historique.</p>
          <button className="btn block" onClick={() => updateSettings((s) => ({ ...s, seenLegProgramVersion: legProgramVersion }))}>
            Compris
          </button>
        </section>
      )}

      {daily && (
        <section className={`card ${isoDone ? '' : 'update'}`}>
          <div className="row">
            <h2 className="grow">Isométriques du jour</h2>
            <button className={`chip ${isoDone ? 'on' : ''}`} onClick={() => setIsoDone(!isoDone)} aria-pressed={isoDone}>
              {isoDone ? 'Faits ✓' : 'À faire'}
            </button>
          </div>
          <p className="small muted">
            {daily.sets} × 45 s, tous les jours, même sans salle. {daily.note}
          </p>
          {!isoDone && (
            <button className="btn primary block" onClick={() => navigate('/iso')}>
              Lancer le minuteur
            </button>
          )}
          <button
            className="link"
            onClick={async () => {
              const ok = await addDailyReminder((pos.phase.maxWeeks ?? 2) * 7)
              if (ok) setReminder(`Ouvre le fichier avec Calendrier et ajoute l’événement : alerte chaque jour à ${REMINDER_HOUR} h.`)
            }}
          >
            Rappel chaque jour à {REMINDER_HOUR} h dans le Calendrier
          </button>
          {reminder && <p className="small">{reminder}</p>}
        </section>
      )}

      <section className="card">
        <div className="row">
          <h2 className="grow">Jambes · {phaseShort}</h2>
          {pos.weekData?.deload && <span className="badge warn">Semaine allégée</span>}
        </div>
        <p className="muted">{pos.phase.name.split(': ')[1] ?? pos.phase.name}</p>
        {pos.finished ? (
          <p>Programme terminé.</p>
        ) : (
          <>
            {pos.week ? (
              <p>
                Semaine {pos.instance}
                {pos.repeat === 'orange' && ' : on refait la semaine (lendemain orange)'}
                {pos.repeat === 'derniere' && ` : on répète la semaine ${pos.week}${pos.loadBonusKg ? ` (+${pos.loadBonusKg.toLocaleString('fr-FR')} kg)` : ''}`}
                {pos.weekData?.blockName && pos.phase.id === 'p4' && ` · ${pos.weekData.blockName}`}
              </p>
            ) : (
              <p>
                {pos.phase.sessionsPerWeek?.length ?? 2} séances par semaine · {legsThisWeek} faite{legsThisWeek > 1 ? 's' : ''} cette semaine
              </p>
            )}
            {pos.week !== undefined && (
              <div className="stack">
                {pos.labels.map((l) => (
                  <div key={l} className={`session-line ${l === pos.label ? 'next' : ''}`}>
                    <div>
                      <strong>Séance {l}</strong>
                      <div className="small muted">{pos.weekData?.sessions[l]?.name}</div>
                    </div>
                    <span className={`badge ${pos.doneLabels.includes(l) ? 'ok' : ''}`}>
                      {pos.doneLabels.includes(l) ? 'Faite ✓' : l === pos.label ? 'Prochaine' : 'À faire'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {knee && (
              <div className={`knee-line ${knee.level}`}>
                <strong>Genou {knee.level}</strong> (lendemain {lastAnswered?.kneeCheck?.lendemain}/10) · {knee.action}
              </div>
            )}
            {phase.jumpNote && <p className="small warn-text">{phase.jumpNote} Les sauts seront sautés (réactivables).</p>}
            {phase.overMax && (
              <p className="small warn-text">
                La phase dure depuis plus de {pos.phase.maxWeeks} semaines : si la douleur ne baisse pas nettement, vois un médecin ou ta kiné.
              </p>
            )}
            <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => navigate('/demarrer/jambes')}>
              Démarrer la séance {pos.label}
            </button>
          </>
        )}

        {pos.phase.exitCriteria?.length ? (
          phase.minReached ? (
            <button className="btn block" style={{ marginTop: 8 }} onClick={() => navigate('/phase/test')}>
              Faire le test de sortie
              {phase.lastTest && !phase.lastTest.passed && ` (dernier : ${phase.lastTest.failed.length} critère${phase.lastTest.failed.length > 1 ? 's' : ''} manquant${phase.lastTest.failed.length > 1 ? 's' : ''})`}
            </button>
          ) : (
            <p className="small muted" style={{ marginTop: 8 }}>
              Test de sortie possible après{' '}
              {pos.phase.minDays !== undefined
                ? `${pos.phase.minDays} jours (jour ${phase.daysInPhase + 1})`
                : `${pos.phase.minWeeks} semaines faites (${pos.weeksDone} pour l’instant)`}
              .
            </p>
          )
        ) : null}

        <details className="small muted" style={{ marginTop: 8 }}>
          <summary>Objectif et règles de la phase</summary>
          <p>{pos.phase.goal}</p>
          <ul>
            {pos.phase.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      </section>

      <section className="card">
        <h2>Volley</h2>
        {ladder ? (
          <p>
            {ladder.current ? `Dernier volley : marche ${ladder.current}. ` : ''}
            Prochain autorisé : <strong>marche {ladder.next}</strong> ({pos.phase.volleyLadder?.find((s) => s.step === ladder.next)?.label}).
            <span className="small muted"> {ladder.reason}</span>
          </p>
        ) : (
          <p className="small muted">
            {pos.phase.rules.find((r) => /volley/i.test(r)) ?? 'Le check genou s’applique aussi au volley.'}
          </p>
        )}
        <button className="btn block" onClick={() => navigate('/volley')}>
          Enregistrer un volley
        </button>
      </section>

      <section className="card">
        <h2>Haut du corps</h2>
        <p className="muted">
          Prochaine : <strong>{upper === 'push' ? 'Push' : 'Pull'}</strong> · tu choisis les exercices au fur et à mesure
        </p>
        <div className="row">
          <StartUpperButton type="push" primary={upper === 'push'} />
          <StartUpperButton type="pull" primary={upper === 'pull'} />
        </div>
      </section>

      <section className="card">
        <div className="row">
          <h2 className="grow">Abdos</h2>
          {absThisWeek > 0 && <span className="badge ok">{absThisWeek} cette semaine</span>}
        </div>
        {abs.next ? (
          <>
            <p className="muted">
              Semaine {abs.next.week} du programme, {abs.next.label} séance
            </p>
            <button
              className="btn block"
              onClick={async () => {
                await startAbsSession(abs.next!.index)
                navigate('/seance')
              }}
            >
              Lancer le circuit abdos
            </button>
          </>
        ) : (
          <p>Programme abdos terminé.</p>
        )}
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
