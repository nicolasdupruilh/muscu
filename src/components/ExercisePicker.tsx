import { useMemo, useState } from 'react'
import type { Exercise, SetLog } from '../db/models'
import { createExercise } from '../db/sessions'
import { ExerciseForm } from './ExerciseForm'
import { lastPerformance } from '../logic/history'

const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/**
 * Liste d'exercices à choisir, en plein écran. Filtrée sur un slot si `slot` est donné.
 * Un bouton permet de créer l'exercice s'il n'existe pas ; il est alors ajouté au slot.
 * Séance libre : `day` met en tête les exercices du jour (push ou pull), et `onPickSuperset`
 * permet de choisir deux exercices à enchaîner en superset.
 */
export function ExercisePicker({
  title,
  slot,
  exercises,
  logs,
  currentId,
  defaultRestSec,
  suggested = [],
  original,
  day,
  onPick,
  onPickSuperset,
  onClose,
}: {
  title: string
  slot?: string
  exercises: Exercise[]
  logs: SetLog[]
  currentId?: string
  defaultRestSec: number
  /** Remplacement en séance cadrée : alternatives prévues, affichées en tête. */
  suggested?: string[]
  /** Remplacement : exercice prévu par le programme, pour pouvoir y revenir. */
  original?: string
  /** Exercices du jour, affichés en tête (« Exercices du push »), le reste en dessous. */
  day?: { title: string; ids: string[] }
  onPick: (id: string) => void
  /** Deux exercices en superset, dans l'ordre choisi. */
  onPickSuperset?: (ids: string[]) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [superset, setSuperset] = useState<string[] | null>(null)

  const list = useMemo(() => {
    const q = normalize(query)
    return exercises
      .filter((e) => !e.archived && (!slot || e.slots.includes(slot)) && (!q || normalize(e.name).includes(q)))
      .map((e) => ({ e, last: lastPerformance(logs, e.id)?.at }))
      .sort((a, b) => (b.last ?? '').localeCompare(a.last ?? '') || a.e.name.localeCompare(b.e.name, 'fr'))
  }, [exercises, logs, slot, query])

  const dayIds = new Set(day?.ids)
  const sections = day
    ? [
        { title: day.title, items: list.filter(({ e }) => dayIds.has(e.id)) },
        { title: 'Autres exercices', items: list.filter(({ e }) => !dayIds.has(e.id)) },
      ].filter((s) => s.items.length > 0)
    : [{ title: undefined, items: list }]

  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id
  const choose = (id: string) => {
    if (!superset) return onPick(id)
    setSuperset(superset.includes(id) ? superset.filter((x) => x !== id) : superset.length < 2 ? [...superset, id] : superset)
  }

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
          showSlots={!slot && !!day}
          showCues={false}
          submitLabel={superset ? 'Créer et ajouter au superset' : 'Créer et choisir'}
          note={slot ? 'Il sera proposé dans ce slot les prochaines fois.' : day ? 'Il sera proposé en tête de liste les prochaines fois.' : undefined}
          onSubmit={async (values) => {
            const id = await createExercise(values)
            setCreating(false)
            setQuery('')
            choose(id)
          }}
        />
      ) : (
        <>
          {onPickSuperset && (
            <div className="chips" role="group" aria-label="Type d’enchaînement">
              <button className={`chip ${superset ? '' : 'on'}`} onClick={() => setSuperset(null)} aria-pressed={!superset}>
                Un exercice
              </button>
              <button className={`chip ${superset ? 'on' : ''}`} onClick={() => setSuperset(superset ?? [])} aria-pressed={!!superset}>
                Superset (2 exercices)
              </button>
            </div>
          )}
          {superset && (
            <div className="card superset-pick">
              <div className="small muted">Série de chaque exercice sans pause, puis le repos.</div>
              {[0, 1].map((i) => (
                <div key={i} className="row">
                  <span className="badge">{i + 1}</span>
                  {superset[i] ? <strong className="grow">{nameOf(superset[i])}</strong> : <span className="grow muted">Touche un exercice</span>}
                  {superset[i] && (
                    <button className="link inline" onClick={() => setSuperset(superset.filter((x) => x !== superset[i]))}>
                      retirer
                    </button>
                  )}
                </div>
              ))}
              <button className="btn primary block" disabled={superset.length < 2} onClick={() => onPickSuperset?.(superset)}>
                Lancer le superset
              </button>
            </div>
          )}
          <button className={`btn block ${superset ? '' : 'primary'}`} onClick={() => setCreating(true)}>
            + Créer un exercice
          </button>
          {exercises.length > 8 && (
            <input className="search" type="search" placeholder="Chercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
          )}
          {(suggested.length > 0 || (original && original !== currentId)) && (
            <>
              <h3 className="picker-section">Alternatives prévues</h3>
              <ul className="list card">
                {original && original !== currentId && (
                  <li>
                    <button className="pick" onClick={() => onPick(original)}>
                      <strong>{nameOf(original)}</strong>
                      <span className="small muted">Exercice prévu par le programme</span>
                    </button>
                  </li>
                )}
                {suggested
                  .filter((id) => id !== currentId && id !== original)
                  .map((id) => {
                    const e = exercises.find((x) => x.id === id)
                    const last = lastPerformance(logs, id)?.at
                    return (
                      e && (
                        <li key={id}>
                          <button className="pick" onClick={() => onPick(id)}>
                            <strong>{e.name}</strong>
                            <span className="small muted">{last ? `Fait le ${shortDate.format(new Date(last))}` : 'Jamais fait'}</span>
                          </button>
                        </li>
                      )
                    )
                  })}
              </ul>
              <h3 className="picker-section">Autre exercice</h3>
            </>
          )}
          {sections.map((section) => (
            <div key={section.title ?? 'all'} className="stack">
              {section.title && <h3 className="picker-section">{section.title}</h3>}
              <ul className="list card">
                {section.items.map(({ e, last }) => {
                  const picked = superset?.indexOf(e.id) ?? -1
                  return (
                    <li key={e.id}>
                      <button className={`pick ${e.id === currentId || picked >= 0 ? 'current' : ''}`} onClick={() => choose(e.id)}>
                        <span>
                          {picked >= 0 && <span className="badge">{picked + 1}</span>} <strong>{e.name}</strong>
                          {e.source === 'user' && <span className="badge"> perso</span>}
                        </span>
                        <span className="small muted">{last ? `Fait le ${shortDate.format(new Date(last))}` : 'Jamais fait'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          {list.length === 0 && <p className="muted">Aucun exercice. Crée-le avec le bouton ci-dessus.</p>}
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
