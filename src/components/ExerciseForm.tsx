import { useState } from 'react'
import { slotOptions } from '../data'
import type { LoadUnit } from '../data/types'
import { formatRest } from '../logic/format'

export interface ExerciseValues {
  name: string
  loadUnit: LoadUnit
  loadIncrementKg?: number
  unilateral: boolean
  defaultRestSec: number
  slots: string[]
  cues: string
}

const units: { value: LoadUnit; label: string }[] = [
  { value: 'kg', label: 'Charge (kg)' },
  { value: 'bodyweight+kg', label: 'Poids du corps + lest' },
  { value: 'bodyweight', label: 'Poids du corps' },
  { value: 'time', label: 'Durée' },
  { value: 'none', label: 'Sans charge' },
]
const increments = [1, 1.25, 2, 2.5, 5, 10]
const rests = [0, 45, 60, 75, 90, 120, 150, 180]

/** Ajoute la valeur actuelle à la liste si elle n'y est pas (ex. un repos de 100 s venu du catalogue). */
const withCurrent = (list: number[], v: number | undefined) => (v === undefined || list.includes(v) ? list : [...list, v].sort((a, b) => a - b))

/** Formulaire d'exercice, en boutons autant que possible : seul le nom (et les consignes) ouvre le clavier. */
export function ExerciseForm({
  initial,
  showSlots,
  showCues,
  submitLabel,
  note,
  onSubmit,
}: {
  initial: ExerciseValues
  /** Choix des slots de la trame où l'exercice peut être proposé. */
  showSlots: boolean
  showCues: boolean
  submitLabel: string
  note?: string
  onSubmit: (values: ExerciseValues) => Promise<void>
}) {
  const [v, setV] = useState(initial)
  const [error, setError] = useState<string>()
  const set = (changes: Partial<ExerciseValues>) => setV((cur) => ({ ...cur, ...changes }))
  const withLoad = v.loadUnit === 'kg' || v.loadUnit === 'bodyweight+kg'

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!v.name.trim()) return
        try {
          await onSubmit({ ...v, loadIncrementKg: withLoad ? v.loadIncrementKg ?? 2.5 : undefined })
        } catch (err) {
          setError((err as Error).message)
        }
      }}
    >
      <label className="field">
        Nom
        <input className="search" value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex. Curl araignée" />
      </label>

      <div className="field">Type de charge</div>
      <div className="chips">
        {units.map((u) => (
          <button type="button" key={u.value} className={`chip ${v.loadUnit === u.value ? 'on' : ''}`} onClick={() => set({ loadUnit: u.value })}>
            {u.label}
          </button>
        ))}
      </div>

      {withLoad && (
        <>
          <div className="field">Cran de charge</div>
          <div className="chips">
            {withCurrent(increments, v.loadIncrementKg).map((i) => (
              <button type="button" key={i} className={`chip ${(v.loadIncrementKg ?? 2.5) === i ? 'on' : ''}`} onClick={() => set({ loadIncrementKg: i })}>
                {i.toLocaleString('fr-FR')} kg
              </button>
            ))}
          </div>
        </>
      )}

      <div className="field">Repos par défaut</div>
      <div className="chips">
        {withCurrent(rests, v.defaultRestSec).map((r) => (
          <button type="button" key={r} className={`chip ${v.defaultRestSec === r ? 'on' : ''}`} onClick={() => set({ defaultRestSec: r })}>
            {r === 0 ? 'Aucun' : formatRest(r)}
          </button>
        ))}
      </div>

      <button type="button" className={`chip ${v.unilateral ? 'on' : ''}`} onClick={() => set({ unilateral: !v.unilateral })}>
        {v.unilateral ? '✓ ' : ''}Unilatéral (saisie par côté)
      </button>

      {showSlots && (
        <>
          <div className="field">Proposé dans la trame haut du corps pour :</div>
          <div className="chips">
            {slotOptions.map((o) => {
              const on = v.slots.includes(o.slot)
              return (
                <button
                  type="button"
                  key={o.slot}
                  className={`chip ${on ? 'on' : ''}`}
                  onClick={() => set({ slots: on ? v.slots.filter((s) => s !== o.slot) : [...v.slots, o.slot] })}
                >
                  {on ? '✓ ' : ''}
                  {o.label}
                </button>
              )
            })}
          </div>
          {v.slots.length === 0 && <p className="small muted">Aucun slot : l’exercice reste disponible hors trame.</p>}
        </>
      )}

      {showCues && (
        <label className="field">
          Consignes
          <textarea className="search textarea" value={v.cues} onChange={(e) => set({ cues: e.target.value })} rows={3} />
        </label>
      )}

      {note && <p className="small muted">{note}</p>}
      {error && <p className="small danger-text">{error}</p>}
      <button className="btn primary block" type="submit" disabled={!v.name.trim()}>
        {submitLabel}
      </button>
    </form>
  )
}
