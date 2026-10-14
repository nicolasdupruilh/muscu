// Saisie d'une séance de volley : date, durée, marche de l'échelle (phase 3), attaques, douleur pendant.
// La question du lendemain (squat unipodal) sera posée le matin suivant, comme pour les jambes.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { KneeScale } from '../components/KneeScale'
import { Stepper } from '../components/Stepper'
import { legProgram } from '../data'
import { logVolley } from '../db/phases'
import { usePhase } from '../hooks'
import { toLocalDate } from '../logic/dates'
import { formatDuration } from '../logic/variants'

const DURATIONS = [60, 90, 120, 150]
const ATTACKS = [0, 10, 20, 30, 50, 80]

export function Volley() {
  const phase = usePhase()
  const navigate = useNavigate()
  const [day, setDay] = useState(toLocalDate(new Date()))
  const [duration, setDuration] = useState(120)
  const [attacks, setAttacks] = useState<number>()
  const [step, setStep] = useState<number>()
  if (!phase) return null

  const { pos, ladder } = phase
  const steps = pos.phase.volleyLadder
  const chosenStep = step ?? ladder?.next
  // Volley interdit avant la phase 3 (ateliers sans saut tolérés en phase 2).
  const forbidden = !steps && legProgram.phases.findIndex((p) => p.id === pos.phase.id) < legProgram.phases.findIndex((p) => p.volleyLadder)

  return (
    <>
      <p>
        <Link to="/">‹ Accueil</Link>
      </p>
      <h1>Séance de volley</h1>
      {forbidden && (
        <div className="card knee rouge">
          <strong>Volley pas encore prévu en {pos.phase.name.split(' :')[0].toLowerCase()}.</strong>
          <div className="small">{pos.phase.rules.find((r) => /volley/i.test(r)) ?? 'Le retour au volley se fait en phase 3.'}</div>
          <div className="small muted">Tu peux quand même l’enregistrer : le suivi du genou reste juste.</div>
        </div>
      )}

      <section className="card stack">
        <label className="field">
          Jour
          <input type="date" value={day} max={toLocalDate(new Date())} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>

        <div className="field">Durée</div>
        <div className="chips">
          {DURATIONS.map((d) => (
            <button key={d} type="button" className={`chip ${duration === d ? 'on' : ''}`} onClick={() => setDuration(d)}>
              {formatDuration(d)}
            </button>
          ))}
        </div>
        <Stepper label="" value={duration} step={15} min={15} onChange={setDuration} format={formatDuration} />

        {steps && ladder && (
          <>
            <div className="field">Marche de l’échelle</div>
            <p className="small muted">
              Autorisée : marche {ladder.next}. {ladder.reason}
            </p>
            <div className="stack">
              {steps.map((s) => (
                <button
                  key={s.step}
                  type="button"
                  className={`chip ladder-step ${chosenStep === s.step ? 'on' : ''}`}
                  onClick={() => setStep(s.step)}
                >
                  {s.step}. {s.label}
                  {s.step > ladder.next && ' (pas encore autorisée)'}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="field">Attaques, environ</div>
        <div className="chips">
          {ATTACKS.map((a) => (
            <button key={a} type="button" className={`chip ${attacks === a ? 'on' : ''}`} onClick={() => setAttacks(a)}>
              {a === 80 ? '80 et +' : a}
            </button>
          ))}
        </div>

        <div className="field">{legProgram.healthCheck.questions.find((q) => q.id === 'pendant')?.label ?? 'Douleur pendant'}, de 0 à 10 :</div>
        <p className="small muted">Ne te fie pas à la douleur qui baisse une fois chaud : c’est le lendemain qui compte.</p>
        <KneeScale
          onPick={async (pendant) => {
            await logVolley({ day, durationMin: duration, ladderStep: steps ? chosenStep : undefined, attacks, pendant })
            navigate('/')
          }}
        />
      </section>
    </>
  )
}
