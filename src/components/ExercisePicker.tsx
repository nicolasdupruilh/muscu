import { useMemo, useState } from 'react'
import type { LoadUnit } from '../data/types'
import type { Exercise, SetLog } from '../db/models'
import { createExercise } from '../db/sessions'
import { formatRest } from '../logic/format'
import { lastPerformance } from '../logic/history'

const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/**
 * Liste d'exercices à choisir, en plein écran. Filtrée sur un slot si `slot` est donné.
 * Un bouton permet de créer l'exercice s'il n'existe pas ; il est alors ajouté au slot.
 */
export function ExercisePicker({
  title,
  slot,
  exercises,
  logs,
  currentId,
  defaultRestSec,
  onPick,
  onClose,
}: {
  title: string
  slot?: string
  exercises: Exercise[]
  logs: SetLog[]
  currentId?: string
  defaultRestSec: number
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const list = useMemo(() => {
    const q = normalize(query)
    return exercises
      .filter((e) => !e.archived && (!slot || e.slots.includes(slot)) && (!q || normalize(e.name).includes(q)))
      .map((e) => ({ e, last: lastPerformance(logs, e.id)?.at }))
      .sort((a, b) => (b.last ?? '').localeCompare(a.last ?? '') || a.e.name.localeCompare(b.e.name, 'fr'))
  }, [exercises, logs, slot, query])

  return (
    <div className="sheet" role="dialog" aria-label={title}>
      <div className="sheet-header">
        <h2 className="grow">{creating ? 'Créer un exercice' : title}</h2>
        <button className="btn" onClick={creating ? () => setCreating(false) : onClose}>
          {creating ? 'Retour' : 'Fermer'}
        </button>
      </div>
      {creating ? (
        <CreateExerciseForm
          initialName={query}
          slot={slot}
          defaultRestSec={defaultRestSec}
          onCreated={(id) => {
            setCreating(false)
            onPick(id)
          }}
        />
      ) : (
        <>
          <button className="btn primary block" onClick={() => setCreating(true)}>
            + Créer un exercice
          </button>
          {exercises.length > 8 && (
            <input className="search" type="search" placeholder="Chercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
          )}
          <ul className="list card">
            {list.map(({ e, last }) => (
              <li key={e.id}>
                <button className={`pick ${e.id === currentId ? 'current' : ''}`} onClick={() => onPick(e.id)}>
                  <span>
                    <strong>{e.name}</strong>
                    {e.source === 'user' && <span className="badge"> perso</span>}
                  </span>
                  <span className="small muted">{last ? `Fait le ${shortDate.format(new Date(last))}` : 'Jamais fait'}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="muted">Aucun exercice. Crée-le avec le bouton ci-dessus.</li>}
          </ul>
        </>
      )}
    </div>
  )
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const units: { value: LoadUnit; label: string }[] = [
  { value: 'kg', label: 'Charge (kg)' },
  { value: 'bodyweight+kg', label: 'Poids du corps + lest' },
  { value: 'bodyweight', label: 'Poids du corps' },
  { value: 'time', label: 'Durée' },
]
const increments = [1, 1.25, 2, 2.5, 5]
const rests = [45, 60, 75, 90, 120, 150, 180]

function CreateExerciseForm({
  initialName,
  slot,
  defaultRestSec,
  onCreated,
}: {
  initialName: string
  slot?: string
  defaultRestSec: number
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState(initialName)
  const [loadUnit, setLoadUnit] = useState<LoadUnit>('kg')
  const [increment, setIncrement] = useState(2.5)
  const [unilateral, setUnilateral] = useState(false)
  const [rest, setRest] = useState(rests.includes(defaultRestSec) ? defaultRestSec : 90)
  const withLoad = loadUnit === 'kg' || loadUnit === 'bodyweight+kg'

  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        const id = await createExercise({
          name,
          loadUnit,
          loadIncrementKg: withLoad ? increment : undefined,
          unilateral,
          defaultRestSec: rest,
          slots: slot ? [slot] : [],
        })
        onCreated(id)
      }}
    >
      <label className="field">
        Nom
        <input className="search" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Curl araignée" autoFocus />
      </label>

      <div className="field">Type de charge</div>
      <div className="chips">
        {units.map((u) => (
          <button type="button" key={u.value} className={`chip ${loadUnit === u.value ? 'on' : ''}`} onClick={() => setLoadUnit(u.value)}>
            {u.label}
          </button>
        ))}
      </div>

      {withLoad && (
        <>
          <div className="field">Cran de charge</div>
          <div className="chips">
            {increments.map((i) => (
              <button type="button" key={i} className={`chip ${increment === i ? 'on' : ''}`} onClick={() => setIncrement(i)}>
                {i.toLocaleString('fr-FR')} kg
              </button>
            ))}
          </div>
        </>
      )}

      <div className="field">Repos par défaut</div>
      <div className="chips">
        {rests.map((r) => (
          <button type="button" key={r} className={`chip ${rest === r ? 'on' : ''}`} onClick={() => setRest(r)}>
            {formatRest(r)}
          </button>
        ))}
      </div>

      <button type="button" className={`chip ${unilateral ? 'on' : ''}`} onClick={() => setUnilateral(!unilateral)}>
        {unilateral ? '✓ ' : ''}Unilatéral (saisie par côté)
      </button>

      {slot && <p className="small muted">Il sera proposé dans ce slot les prochaines fois.</p>}
      <button className="btn primary block" type="submit" disabled={!name.trim()}>
        Créer et choisir
      </button>
    </form>
  )
}
