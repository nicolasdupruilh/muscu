// « Combien de temps tu as ? » (séance jambes) : un appui sur une durée lance la variante qui tient dans ce temps ;
// la liste en dessous permet de prendre une autre variante. Push et pull sont libres, sans variante.
import { Navigate, useNavigate, useParams } from 'react-router'
import { catalogue } from '../data'
import type { Variant } from '../data/types'
import { startLegSession } from '../db/phases'
import { useActiveSession, useDurationFactor, usePhase } from '../hooks'
import { chooseVariant, correctedMin, formatDuration, lastSessionsLabel, TIME_CHOICES } from '../logic/variants'

interface Choice extends Variant {
  /** Résumé du contenu : « 7 exercices, 2 supersets ». */
  summary: string
  /** Exercices principaux, pour reconnaître la variante. */
  detail: string
}

const names = new Map(catalogue.exercises.map((e) => [e.id, e.name]))

function summarize(lines: { superset?: string; id: string }[]): Pick<Choice, 'summary' | 'detail'> {
  const supersets = new Set(lines.map((l) => l.superset).filter(Boolean)).size
  const detail = lines
    .filter((l) => l.id !== 'echauffement-jambes')
    .map((l) => names.get(l.id) ?? l.id)
    .join(', ')
  return { summary: `${lines.length} exercices${supersets ? `, ${supersets} superset${supersets > 1 ? 's' : ''}` : ''}`, detail }
}

export function Demarrer() {
  const { kind } = useParams()
  const active = useActiveSession()
  const phase = usePhase()
  const factor = useDurationFactor()
  const navigate = useNavigate()
  if (active === undefined || !phase || !factor) return null
  if (active) return <Navigate to="/seance" replace />

  let title: string
  let choices: Choice[]
  let start: (variantId: string) => Promise<number>
  if (kind === 'jambes') {
    const { pos } = phase
    const session = pos.session
    if (pos.finished || !session) return <Navigate to="/" replace />
    title = `${pos.phase.name} · ${session.name}${pos.week ? ` · semaine ${pos.instance}` : ''}`
    choices = session.variants.map((v) => ({ ...v, ...summarize(v.items.map((i) => ({ id: i.exerciseId, superset: i.superset }))) }))
    start = (id) => startLegSession(id)
  } else {
    return <Navigate to="/" replace />
  }

  const go = async (variantId: string) => {
    await start(variantId)
    navigate('/seance', { replace: true })
  }
  const minutes = (v: Variant) => correctedMin(v, factor.factor)

  return (
    <>
      <h1>Combien de temps tu as ?</h1>
      <p className="muted">{title}</p>
      <div className="time-choices">
        {TIME_CHOICES.map((t) => {
          const v = chooseVariant(choices, t.min, factor.factor)
          return (
            <button key={t.label} className="btn time-choice" onClick={() => go(v.id)}>
              <strong>{t.label}</strong>
              <span className="small">→ {v.label}</span>
            </button>
          )
        })}
      </div>
      {factor.factor !== 1 && (
        <p className="small muted">
          Durées corrigées ×{factor.factor.toLocaleString('fr-FR')} d’après {lastSessionsLabel(factor.count)}.
        </p>
      )}

      <h2 style={{ marginTop: 24 }}>Ou choisis une variante</h2>
      <div className="stack">
        {choices.map((v) => (
          <button key={v.id} className="card variant-choice" onClick={() => go(v.id)}>
            <span className="row">
              <strong className="grow">{v.label}</strong>
              <span className="badge">≈ {formatDuration(minutes(v))}</span>
            </span>
            <span className="small">{v.summary}</span>
            <span className="small muted">{v.detail}</span>
          </button>
        ))}
      </div>
    </>
  )
}
