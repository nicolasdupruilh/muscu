// Isométriques du jour (phase 0) : minuteur guidé, tenue après tenue, avec le repos entre les deux.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { signal, unlockAudio } from '../alarm'
import { HoldTimer } from '../components/HoldTimer'
import { catalogue, legProgram } from '../data'
import type { DailyItem } from '../data/types'
import { setIsoDone } from '../db/phases'
import { usePhase, useSessions } from '../hooks'
import { toLocalDate } from '../logic/dates'
import { dailyReminderIcs } from '../logic/ics'
import { formatClock } from '../logic/rest'
import { parseReps } from '../logic/reps'
import { formatRest } from '../logic/format'
import { shareFile } from '../share'
import { useWakeLock } from '../wakeLock'

/** Isométriques à faire chaque jour : ceux de la phase en cours, sinon ceux de la phase 0. */
export const dailyOf = (phaseDaily?: DailyItem[]) => phaseDaily ?? legProgram.phases.find((p) => p.daily)?.daily ?? []

export const REMINDER_HOUR = 18

/** Ajoute au Calendrier de l'iPhone un rappel quotidien à 18 h pendant la durée maximale de la phase. */
export async function addDailyReminder(days: number) {
  const ics = dailyReminderIcs({
    title: 'Isométriques genou',
    description: '5 × 45 s, genou à 60°, 2 min de repos. Même les jours sans salle. Coche-les dans l’appli Muscu.',
    start: new Date(),
    hour: REMINDER_HOUR,
    durationMin: 15,
    days,
    url: location.href.split('#')[0],
  })
  return shareFile(new File([ics], 'rappel-isometriques.ics', { type: 'text/calendar' }), 'Rappel isométriques')
}

/** Repos entre deux tenues, calculé depuis l'heure de fin. */
function RestCountdown({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [endsAt] = useState(Date.now() + seconds * 1000)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  const left = endsAt - now
  useEffect(() => {
    if (left <= 0) {
      signal()
      onDone()
    }
  }, [left, onDone])
  return (
    <div className="hold-timer">
      <div className="small muted">Repos</div>
      <div className="hold-clock">{formatClock(Math.max(0, left))}</div>
      <button className="btn" onClick={onDone}>
        Passer
      </button>
    </div>
  )
}

export function Iso() {
  const phase = usePhase()
  const sessions = useSessions()
  const navigate = useNavigate()
  const [done, setDone] = useState(0)
  const [resting, setResting] = useState(false)
  useWakeLock(true)
  if (!phase || !sessions) return null

  const item = dailyOf(phase.pos.phase.daily)[0]
  if (!item) return <p>Pas d’isométriques prévus dans cette phase.</p>
  const exercise = catalogue.exercises.find((e) => e.id === item.exerciseId)
  const seconds = parseReps(item.reps).value ?? 45
  const doneToday = sessions.some((s) => s.type === 'iso' && toLocalDate(new Date(s.date)) === toLocalDate(new Date()))
  const finished = done >= item.sets

  const holdDone = async () => {
    const n = done + 1
    setDone(n)
    if (n >= item.sets) await setIsoDone(true)
    else setResting(true)
  }

  return (
    <>
      <p>
        <Link to="/">‹ Accueil</Link>
      </p>
      <h1>Isométriques du jour</h1>
      <p className="muted">
        {exercise?.name} · {item.sets} × {seconds} s · repos {formatRest(item.restSec)}
      </p>
      {exercise?.cues && <p className="small">{exercise.cues}</p>}
      {item.note && <p className="small muted">{item.note}</p>}
      {doneToday && !finished && <p className="badge ok">Déjà faits aujourd’hui ✓</p>}

      <section className="card stack">
        <div className="rounds" aria-label={`${done} tenues sur ${item.sets}`}>
          {Array.from({ length: item.sets }, (_, i) => (
            <span key={i} className={`dot ${i < done ? 'on' : ''}`} />
          ))}
        </div>
        {finished ? (
          <>
            <p>
              <strong>Les {item.sets} tenues sont faites ✓</strong>
            </p>
            <button className="btn primary block" onClick={() => navigate('/')}>
              Retour à l’accueil
            </button>
          </>
        ) : resting ? (
          <RestCountdown seconds={item.restSec} onDone={() => setResting(false)} />
        ) : (
          <>
            <h2>
              Tenue {done + 1} / {item.sets}
            </h2>
            <HoldTimer key={done} seconds={seconds} label="Commencer la tenue" onDone={() => void holdDone()} />
          </>
        )}
      </section>

      <button
        className="link"
        onClick={() => {
          unlockAudio()
          void setIsoDone(true).then(() => navigate('/'))
        }}
      >
        Je les ai faits sans le minuteur
      </button>
    </>
  )
}
