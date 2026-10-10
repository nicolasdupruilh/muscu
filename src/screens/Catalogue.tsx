// Réglages › Catalogue d'exercices : voir, modifier, créer, archiver.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ExerciseForm, type ExerciseValues } from '../components/ExerciseForm'
import { normalize } from '../components/ExercisePicker'
import { absProgram, legProgram, slotOptions, upperBody } from '../data'
import { resetToCatalogue, setArchived, updateExercise } from '../db/catalogue'
import type { Exercise } from '../db/models'
import { createExercise } from '../db/sessions'
import { useExercises, useSetLogs } from '../hooks'
import { formatRest } from '../logic/format'

const categoryLabels: Record<string, string> = {
  strength: 'Force',
  hypertrophy: 'Hypertrophie',
  skill: 'Technique',
  plyo: 'Pliométrie',
  olympic: 'Haltérophilie',
  power: 'Puissance',
  core: 'Gainage et abdos',
  conditioning: 'Cardio',
  warmup: 'Échauffement',
  perso: 'Créés par moi',
}
const categoryOrder = Object.keys(categoryLabels)

const unitLabels: Record<string, string> = {
  kg: 'charge',
  'bodyweight+kg': 'poids du corps + lest',
  bodyweight: 'poids du corps',
  time: 'durée',
  none: 'sans charge',
}

/** Exercices utilisés par les programmes (jambes, abdos, exercices par défaut de la trame). */
const programUses = (() => {
  const uses = new Map<string, string[]>()
  const add = (id: string, what: string) => uses.set(id, [...new Set([...(uses.get(id) ?? []), what])])
  for (const w of legProgram.weeks) for (const s of Object.values(w.sessions)) for (const v of s.variants) for (const it of v.items) add(it.exerciseId, 'programme jambes')
  for (const b of absProgram.blocks) for (const it of b.items) add(it.exerciseId, 'programme abdos')
  for (const t of upperBody.templates) for (const v of t.variants) for (const s of v.slots) add(s.defaultExerciseId, `exercice par défaut (${t.name})`)
  return uses
})()

const slotLabel = new Map(slotOptions.map((o) => [o.slot, o.label]))

export function CatalogueListe() {
  const exercises = useExercises()
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  if (!exercises) return null

  const q = normalize(query)
  const all = [...exercises.values()]
  const visible = all.filter((e) => (showArchived ? e.archived : !e.archived) && (!q || normalize(e.name).includes(q)))
  const groups = categoryOrder
    .concat([...new Set(visible.map((e) => e.category))].filter((c) => !categoryOrder.includes(c)))
    .map((c) => ({ c, items: visible.filter((e) => e.category === c).sort((a, b) => a.name.localeCompare(b.name, 'fr')) }))
    .filter((g) => g.items.length)
  const archivedCount = all.filter((e) => e.archived).length

  return (
    <>
      <p>
        <Link to="/reglages">‹ Réglages</Link>
      </p>
      <h1>Catalogue</h1>
      <Link className="btn primary block" to="/reglages/catalogue/nouveau">
        + Créer un exercice
      </Link>
      <input className="search" style={{ marginTop: 12 }} type="search" placeholder="Chercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="chips" style={{ marginTop: 12 }}>
        <button className={`chip ${!showArchived ? 'on' : ''}`} onClick={() => setShowArchived(false)}>
          Actifs
        </button>
        <button className={`chip ${showArchived ? 'on' : ''}`} onClick={() => setShowArchived(true)}>
          Archivés ({archivedCount})
        </button>
      </div>

      {groups.length === 0 && <p className="muted" style={{ marginTop: 16 }}>{showArchived ? 'Aucun exercice archivé.' : 'Aucun exercice trouvé.'}</p>}
      {groups.map(({ c, items }) => (
        <section key={c} className="card">
          <h2>{categoryLabels[c] ?? c}</h2>
          <ul className="list">
            {items.map((e) => (
              <li key={e.id}>
                <Link className="history-row" to={`/reglages/catalogue/${encodeURIComponent(e.id)}`}>
                  <span>
                    <strong>{e.name}</strong>
                    <span className="small muted">
                      {unitLabels[e.loadUnit]}
                      {e.slots.length > 0 && ` · ${e.slots.map((s) => slotLabel.get(s)?.split(' · ')[1] ?? s).join(', ')}`}
                    </span>
                  </span>
                  <span className="row">
                    {e.source === 'user' && <span className="badge">perso</span>}
                    {e.userModified && <span className="badge">modifié</span>}
                    <span aria-hidden>›</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

const toValues = (e: Exercise): ExerciseValues => ({
  name: e.name,
  loadUnit: e.loadUnit,
  loadIncrementKg: e.loadIncrementKg,
  unilateral: e.unilateral,
  defaultRestSec: e.defaultRestSec,
  slots: e.slots,
  cues: e.cues,
})

export function CatalogueFiche() {
  const { id } = useParams()
  const exercises = useExercises()
  const logs = useSetLogs()
  const navigate = useNavigate()
  if (!exercises || !logs || !id) return null
  const ex = exercises.get(id)
  if (!ex) return <p>Exercice introuvable.</p>

  const uses = programUses.get(ex.id) ?? []
  const setCount = logs.filter((l) => l.exerciseId === ex.id && l.done).length

  return (
    <>
      <p>
        <Link to="/reglages/catalogue">‹ Catalogue</Link>
      </p>
      <h1>{ex.name}</h1>
      <p className="small muted">
        {ex.source === 'user' ? 'Exercice créé par toi' : ex.userModified ? 'Exercice du catalogue, modifié par toi' : 'Exercice du catalogue'}
        {ex.archived && ' · archivé'}
        {ex.defaultRestSec > 0 && ` · repos ${formatRest(ex.defaultRestSec)}`}
      </p>
      {uses.length > 0 && <p className="small muted">Utilisé par : {uses.join(', ')}.</p>}
      {setCount > 0 && (
        <p className="small">
          <Link to={`/historique/exercice/${encodeURIComponent(ex.id)}`}>Voir l’historique ({setCount} séries)</Link>
        </p>
      )}

      <section className="card">
        <ExerciseForm
          key={`${ex.id}-${ex.userModified}`}
          initial={toValues(ex)}
          showSlots
          showCues
          submitLabel="Enregistrer"
          note={ex.source === 'catalogue' ? 'Une fois modifié, cet exercice ne sera plus mis à jour par le catalogue de départ.' : undefined}
          onSubmit={async (values) => {
            await updateExercise(ex.id, values)
            navigate('/reglages/catalogue')
          }}
        />
      </section>

      <div className="stack" style={{ marginTop: 16 }}>
        <button
          className="btn block"
          onClick={async () => {
            if (!ex.archived && uses.some((u) => u.startsWith('programme')) && !confirm(`Cet exercice fait partie du ${uses[0]} : il y restera. L’archiver quand même ?`)) return
            await setArchived(ex.id, !ex.archived)
          }}
        >
          {ex.archived ? 'Réactiver l’exercice' : 'Archiver l’exercice'}
        </button>
        <p className="small muted">Un exercice archivé n’est plus proposé, mais son historique est conservé.</p>
        {ex.source === 'catalogue' && ex.userModified && (
          <button
            className="link"
            onClick={async () => {
              if (!confirm('Annuler tes modifications et revenir à la version du catalogue de départ ?')) return
              await resetToCatalogue(ex.id)
            }}
          >
            Revenir à la version du catalogue
          </button>
        )}
      </div>
    </>
  )
}

export function CatalogueNouveau() {
  const navigate = useNavigate()
  return (
    <>
      <p>
        <Link to="/reglages/catalogue">‹ Catalogue</Link>
      </p>
      <h1>Nouvel exercice</h1>
      <section className="card">
        <ExerciseForm
          initial={{ name: '', loadUnit: 'kg', loadIncrementKg: 2.5, unilateral: false, defaultRestSec: 90, slots: [], cues: '' }}
          showSlots
          showCues
          submitLabel="Créer l’exercice"
          onSubmit={async (values) => {
            const id = await createExercise(values)
            navigate(`/reglages/catalogue/${encodeURIComponent(id)}`, { replace: true })
          }}
        />
      </section>
    </>
  )
}
