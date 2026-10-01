import { useMemo, useState } from 'react'
import type { Exercise, SetLog } from '../db/models'
import { createExercise } from '../db/sessions'
import { ExerciseForm } from './ExerciseForm'
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
        <ExerciseForm
          initial={{
            name: query,
            loadUnit: 'kg',
            loadIncrementKg: 2.5,
            unilateral: false,
            defaultRestSec: defaultRestSec || 90,
            slots: slot ? [slot] : [],
            cues: '',
          }}
          showSlots={false}
          showCues={false}
          submitLabel="Créer et choisir"
          note={slot ? 'Il sera proposé dans ce slot les prochaines fois.' : undefined}
          onSubmit={async (values) => {
            const id = await createExercise(values)
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

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
