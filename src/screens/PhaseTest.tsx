// Test de sortie d'une phase : chaque critère sous sa forme (échelle 0-10, oui/non, ratio droite/gauche, calculé).
// Phase suivante seulement si tout est validé.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { legPhase } from '../data'
import type { ExitCriterion } from '../data/types'
import type { CriterionAnswer } from '../db/models'
import { submitPhaseTest } from '../db/phases'
import { usePhase } from '../hooks'
import { criterionPassed } from '../logic/phases'

function ScaleInput({ value, max, onChange }: { value?: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="knee-scale">
      {Array.from({ length: 11 }, (_, v) => (
        <button key={v} type="button" className={`btn knee-btn ${v <= max ? 'vert' : 'rouge'} ${value === v ? 'picked' : ''}`} onClick={() => onChange(v)}>
          {v}
        </button>
      ))}
    </div>
  )
}

function RatioInput({ value, min, onChange }: { value?: { right: number; left: number }; min: number; onChange: (v: { right: number; left: number }) => void }) {
  const v = value ?? { right: 0, left: 0 }
  const field = (side: 'right' | 'left', label: string) => (
    <label className="field grow">
      {label} (cm)
      <input
        className="search"
        type="text"
        inputMode="numeric"
        value={v[side] || ''}
        onChange={(e) => onChange({ ...v, [side]: Number(e.target.value.replace(',', '.')) || 0 })}
      />
    </label>
  )
  const ratio = v.left > 0 ? v.right / v.left : undefined
  return (
    <>
      <div className="row">
        {field('right', 'Jambe droite')}
        {field('left', 'Jambe gauche')}
      </div>
      {ratio !== undefined && (
        <p className={ratio >= min ? 'ok-text' : 'warn-text'}>
          Droite = {Math.round(ratio * 100)} % de la gauche (il faut {Math.round(min * 100)} % ou plus)
        </p>
      )}
    </>
  )
}

export function PhaseTest() {
  const phase = usePhase()
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<Record<string, CriterionAnswer>>({})
  const [result, setResult] = useState<{ passed: boolean; failed: string[]; next?: string }>()
  if (!phase) return null
  const { pos, auto } = phase
  const criteria = pos.phase.exitCriteria ?? []
  const set = (id: string, v: CriterionAnswer) => setAnswers((a) => ({ ...a, [id]: v }))

  if (result) {
    return (
      <>
        <h1>{result.passed ? 'Phase validée' : 'Pas encore'}</h1>
        {result.passed && result.next ? (
          <section className="card knee vert">
            <strong>Tu passes en {legPhase(result.next)?.name}.</strong>
            <p className="small">{legPhase(result.next)?.goal}</p>
          </section>
        ) : (
          <section className="card stack">
            <p>Critères pas encore remplis :</p>
            <ul>
              {criteria
                .filter((c) => result.failed.includes(c.id))
                .map((c) => (
                  <li key={c.id}>{c.label}</li>
                ))}
            </ul>
            <p className="small muted">Tu restes en {pos.phase.name.split(' :')[0].toLowerCase()} : la phase dure plus longtemps, c’est prévu. Refais le test plus tard.</p>
          </section>
        )}
        <button className="btn primary block" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
          Retour à l’accueil
        </button>
      </>
    )
  }

  if (!phase.minReached) {
    const wait = pos.phase.minDays !== undefined ? `${pos.phase.minDays} jours (${phase.daysInPhase} faits)` : `${pos.phase.minWeeks} semaines (${pos.weeksDone} faites)`
    return (
      <>
        <p>
          <Link to="/">‹ Accueil</Link>
        </p>
        <h1>Test de sortie</h1>
        <p>La durée minimale de la phase n’est pas encore faite : {wait}.</p>
      </>
    )
  }

  const answered = (c: ExitCriterion) => (c.type ?? 'scale') === 'auto' || answers[c.id] !== undefined
  const complete = criteria.every(answered)

  return (
    <>
      <p>
        <Link to="/">‹ Accueil</Link>
      </p>
      <h1>Test de sortie</h1>
      <p className="muted">
        {pos.phase.name} · commencée il y a {phase.daysInPhase} jour{phase.daysInPhase > 1 ? 's' : ''}
      </p>
      <p className="small muted">Réponds honnêtement : on ne passe à la phase suivante que si tous les critères sont remplis.</p>

      {criteria.map((c) => {
        const type = c.type ?? 'scale'
        const ok = criterionPassed(c, answers[c.id], auto[c.id])
        return (
          <section key={c.id} className="card stack">
            <div className="row">
              <strong className="grow">{c.label}</strong>
              {answered(c) && <span className={`badge ${ok ? 'ok' : 'warn'}`}>{ok ? 'OK' : 'Non'}</span>}
            </div>
            {type === 'scale' && (
              <>
                <p className="small muted">Douleur de 0 à 10 : {c.max} ou moins pour valider.</p>
                <ScaleInput value={answers[c.id] as number | undefined} max={c.max ?? 10} onChange={(v) => set(c.id, v)} />
              </>
            )}
            {type === 'yesno' && (
              <div className="row">
                <button type="button" className={`btn grow ${answers[c.id] === true ? 'primary' : ''}`} onClick={() => set(c.id, true)}>
                  Oui
                </button>
                <button type="button" className={`btn grow ${answers[c.id] === false ? 'primary' : ''}`} onClick={() => set(c.id, false)}>
                  Non
                </button>
              </div>
            )}
            {type === 'ratio' && (
              <RatioInput value={answers[c.id] as { right: number; left: number } | undefined} min={c.min ?? 1} onChange={(v) => set(c.id, v)} />
            )}
            {type === 'auto' && <p className="small">Calculé depuis ton historique : {auto[c.id]?.detail}</p>}
          </section>
        )
      })}

      <button
        className="btn primary block"
        style={{ marginTop: 16 }}
        disabled={!complete}
        onClick={async () => setResult(await submitPhaseTest(answers))}
      >
        {complete ? 'Valider le test' : 'Réponds à tous les critères'}
      </button>
    </>
  )
}
