import { useState } from 'react'
import { LOAD_STEP_MIN, parseLoad } from '../logic/load'

const fmt = (kg: number) => kg.toLocaleString('fr-FR')

/**
 * Charge réglable au pouce : − / + au cran de l'exercice, ±0,5 et ±10 kg,
 * et saisie directe au clavier décimal en touchant la valeur. Toute charge multiple de 0,5 kg est permise.
 */
export function LoadStepper({
  label,
  value,
  onChange,
  step,
  format,
}: {
  label: string
  value: number
  onChange: (kg: number) => void
  /** Cran de l'exercice. */
  step: number
  format: (kg: number) => string
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [note, setNote] = useState<string>()
  // Arrondi au centième pour éviter 2,5 + 1,25 = 3,7499999…
  const set = (kg: number) => {
    setNote(undefined)
    onChange(Math.max(0, Math.round(kg * 100) / 100))
  }

  const commit = () => {
    if (editing === null) return
    const parsed = parseLoad(editing)
    if (parsed) {
      onChange(parsed.kg)
      setNote(parsed.rounded ? `Arrondi à ${fmt(parsed.kg)} kg.` : undefined)
    } else if (editing.trim()) {
      setNote('Charge non reconnue : tape un nombre, par exemple 74,5.')
    }
    setEditing(null)
  }

  return (
    <div className="stepper">
      <div className="stepper-label">{label}</div>
      <div className="stepper-row">
        <button type="button" className="btn stepper-btn" onClick={() => set(value - step)} aria-label={`${label} moins ${fmt(step)} kg`}>
          −
        </button>
        {editing !== null ? (
          <input
            className="stepper-input"
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoFocus
            aria-label={`${label} en kg`}
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setEditing(null)
            }}
            onFocus={(e) => e.currentTarget.select()}
          />
        ) : (
          <button type="button" className="stepper-value stepper-value-btn" onClick={() => setEditing(fmt(value))} aria-label={`${label} : ${format(value)}, toucher pour saisir`}>
            {format(value)}
          </button>
        )}
        <button type="button" className="btn stepper-btn" onClick={() => set(value + step)} aria-label={`${label} plus ${fmt(step)} kg`}>
          +
        </button>
      </div>
      <div className="stepper-fine">
        <button type="button" className="chip" onClick={() => set(value - 10)}>
          −10
        </button>
        <button type="button" className="chip" onClick={() => set(value - LOAD_STEP_MIN)}>
          −0,5
        </button>
        <button type="button" className="chip" onClick={() => set(value + LOAD_STEP_MIN)}>
          +0,5
        </button>
        <button type="button" className="chip" onClick={() => set(value + 10)}>
          +10
        </button>
      </div>
      {note && <div className="small muted">{note}</div>}
    </div>
  )
}
