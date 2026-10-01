// Aperçu en lecture seule de ce qui est prévu. La saisie série par série arrive aux étapes 2 et 4.
import { Link, useParams } from 'react-router'
import { absBlockForWeek, absProgram, legWeek, programShapes } from '../data'
import { useExercises } from '../hooks'
import { formatKg, formatReps, formatRest } from '../logic/format'
import { positionOf } from '../logic/programs'
import { describeTempo } from '../logic/tempo'

function ComingSoon() {
  return <p className="small muted">Aperçu seulement : la saisie des séries arrive dans une prochaine étape.</p>
}

export function ApercuJambes() {
  const exercises = useExercises()
  const pos = positionOf(programShapes.jambes, Number(useParams().index))
  const week = legWeek(pos.week)
  const session = week?.sessions[pos.label]
  if (!exercises) return null
  if (!week || !session) return <p>Séance introuvable.</p>

  return (
    <>
      <h1>{session.name}</h1>
      <p className="muted">
        Semaine {pos.week} · {week.blockName} {week.deload && <span className="badge warn">Semaine allégée</span>}
      </p>
      <ComingSoon />
      <ul className="list card">
        {session.items.map((it, i) => {
          const ex = exercises.get(it.exerciseId)
          return (
            <li key={i}>
              <strong>{ex?.name ?? it.exerciseId}</strong>
              {ex?.unilateral && <span className="badge"> par côté</span>}
              <div>
                {it.sets} × {formatReps(it.reps)}
                {it.targetLoadKg !== undefined && ` · ${formatKg(it.targetLoadKg)}`}
                {it.restSec > 0 && ` · repos ${formatRest(it.restSec)}`}
              </div>
              {it.tempo && (
                <div className="small muted">
                  Tempo {it.tempo} : {describeTempo(it.tempo)}
                </div>
              )}
              {it.note && <div className="small">{it.note}</div>}
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function ApercuAbdos() {
  const exercises = useExercises()
  const pos = positionOf(programShapes.abdos, Number(useParams().index))
  const block = absBlockForWeek(pos.week)
  if (!exercises) return null
  if (!block) return <p>Séance introuvable.</p>

  return (
    <>
      <h1>Abdos</h1>
      <p className="muted">
        Semaine {pos.week} · {pos.label} séance de la semaine
      </p>
      <ComingSoon />
      <div className="card">
        <p>{absProgram.format}</p>
        <ul className="list">
          {block.items.map((it, i) => (
            <li key={i}>
              <strong>{exercises.get(it.exerciseId)?.name ?? it.exerciseId}</strong>
              <div>
                {it.rounds} tours · {formatReps(it.reps)}
              </div>
              {it.note && <div className="small">{it.note}</div>}
            </li>
          ))}
        </ul>
      </div>
      <p style={{ marginTop: 16 }}>
        <Link to="/">Retour à l'accueil</Link>
      </p>
    </>
  )
}
