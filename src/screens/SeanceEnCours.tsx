import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { LoadUnit } from '../data/types'
import { ExercisePicker } from '../components/ExercisePicker'
import { Stepper } from '../components/Stepper'
import type { Exercise, PlannedExercise, Session, SetLog } from '../db/models'
import { abandonSession, deleteSet, finishSession, logSet, updatePlan, updateSet } from '../db/sessions'
import { useActiveSession, useExercises, useSetLogs } from '../hooks'
import { doubleProgression, type Target } from '../logic/doubleProgression'
import { formatLoad, formatRest, formatSet, formatValue } from '../logic/format'
import { hasLoad, lastPerformance, setValue, toPastSets, type LastPerformance } from '../logic/history'
import { ChoixSeance } from './ChoixSeance'

const typeNames: Record<string, string> = { push: 'Push', pull: 'Pull', libre: 'Séance libre' }
const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

type PickerState = { mode: 'change'; key: string } | { mode: 'add' } | null

/** Écran /seance : la séance en cours, ou le choix d'une séance s'il n'y en a pas. */
export function Seance() {
  const session = useActiveSession()
  if (session === undefined) return null
  return session ? <SeanceEnCours session={session} /> : <ChoixSeance />
}

function SeanceEnCours({ session }: { session: Session }) {
  const exercises = useExercises()
  const logs = useSetLogs()
  const navigate = useNavigate()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickerState>(null)
  if (!exercises || !logs) return null

  const id = session.id!
  const plan = session.plan ?? []
  const sessionLogs = logs.filter((l) => l.sessionId === id)
  const setsOf = (key: string) => sessionLogs.filter((l) => l.planKey === key).sort((a, b) => a.setNumber - b.setNumber)
  const isComplete = (p: PlannedExercise) => setsOf(p.key).length >= p.sets
  const open = openKey ?? plan.find((p) => !p.skipped && !isComplete(p))?.key
  const remaining = plan.filter((p) => !p.skipped && !isComplete(p)).length

  const move = (key: string, dir: -1 | 1) =>
    updatePlan(id, (pl) => {
      const i = pl.findIndex((p) => p.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= pl.length) return pl
      const next = [...pl]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const patch = (key: string, changes: Partial<PlannedExercise>) =>
    updatePlan(id, (pl) => pl.map((p) => (p.key === key ? { ...p, ...changes } : p)))

  const pickerTarget = picker?.mode === 'change' ? plan.find((p) => p.key === picker.key) : undefined

  if (picker) {
    return (
      <ExercisePicker
        title={pickerTarget ? `${pickerTarget.label ?? 'Exercice'} : choisir` : 'Ajouter un exercice'}
        slot={pickerTarget?.slot}
        exercises={[...exercises.values()]}
        logs={logs}
        currentId={pickerTarget?.exerciseId}
        defaultRestSec={pickerTarget?.restSec ?? 90}
        onClose={() => setPicker(null)}
        onPick={async (exerciseId) => {
          if (pickerTarget) {
            await patch(pickerTarget.key, { exerciseId })
            setOpenKey(pickerTarget.key)
          } else {
            const ex = exercises.get(exerciseId)
            const key = `extra:${Date.now()}`
            await updatePlan(id, (pl) => [
              ...pl,
              {
                key,
                exerciseId,
                sets: 3,
                repRange: ex?.loadUnit === 'time' ? [20, 40] : [8, 12],
                restSec: ex?.defaultRestSec || 90,
              },
            ])
            setOpenKey(key)
          }
          setPicker(null)
        }}
      />
    )
  }

  return (
    <>
      <h1>{typeNames[session.type] ?? session.type}</h1>
      <p className="muted">
        Commencée à {timeFormat.format(new Date(session.date))} ·{' '}
        {remaining === 0 ? 'tout est fait' : `${remaining} exercice${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`}
      </p>

      {plan.map((p, i) => {
        const ex = exercises.get(p.exerciseId)
        if (!ex) return null
        return (
          <ExerciseCard
            key={p.key}
            sessionId={id}
            planned={p}
            exercise={ex}
            sets={setsOf(p.key)}
            last={lastPerformance(logs, p.exerciseId, id)}
            open={open === p.key}
            first={i === 0}
            lastInPlan={i === plan.length - 1}
            onToggle={() => setOpenKey(open === p.key ? '' : p.key)}
            onChange={() => setPicker({ mode: 'change', key: p.key })}
            onMove={(dir) => move(p.key, dir)}
            onSkip={() => {
              patch(p.key, { skipped: !p.skipped })
              setOpenKey(null)
            }}
            onRemove={() => updatePlan(id, (pl) => pl.filter((x) => x.key !== p.key))}
            onSets={(sets) => patch(p.key, { sets })}
            onValidated={(completed) => completed && setOpenKey(null)}
          />
        )
      })}

      <button className="btn block" style={{ marginTop: 16 }} onClick={() => setPicker({ mode: 'add' })}>
        + Ajouter un exercice hors trame
      </button>

      <div className="stack" style={{ marginTop: 24 }}>
        <button
          className="btn primary block"
          onClick={async () => {
            if (remaining > 0 && !confirm('Il reste des exercices non terminés. Terminer la séance quand même ?')) return
            await finishSession(id)
            navigate('/')
          }}
        >
          Terminer la séance
        </button>
        <button
          className="link"
          onClick={async () => {
            if (!confirm('Abandonner la séance ? Les séries saisies seront effacées.')) return
            await abandonSession(id)
            navigate('/')
          }}
        >
          Abandonner la séance
        </button>
      </div>
    </>
  )
}

function ExerciseCard({
  sessionId,
  planned,
  exercise,
  sets,
  last,
  open,
  first,
  lastInPlan,
  onToggle,
  onChange,
  onMove,
  onSkip,
  onRemove,
  onSets,
  onValidated,
}: {
  sessionId: number
  planned: PlannedExercise
  exercise: Exercise
  sets: SetLog[]
  last?: LastPerformance
  open: boolean
  first: boolean
  lastInPlan: boolean
  onToggle: () => void
  onChange: () => void
  onMove: (dir: -1 | 1) => void
  onSkip: () => void
  onRemove: () => void
  onSets: (n: number) => void
  onValidated: (completed: boolean) => void
}) {
  const [editing, setEditing] = useState<number | null>(null)
  const ref = useRef<HTMLElement>(null)
  // L'exercice qui s'ouvre vient se placer en haut de l'écran.
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [open])
  const unit = exercise.loadUnit
  const target = doubleProgression({
    last: last ? toPastSets(last.sets, unit) : [],
    repRange: planned.repRange,
    sets: planned.sets,
    incrementKg: hasLoad(unit) ? exercise.loadIncrementKg ?? 2.5 : undefined,
    unit: unit === 'time' ? 's' : 'reps',
  })
  const done = sets.length >= planned.sets
  const valueUnit = unit === 'time' ? 's' : 'reps'
  const status = planned.skipped ? 'Sautée' : done ? 'Fait ✓' : sets.length ? `${sets.length}/${planned.sets}` : ''

  return (
    <section ref={ref} className={`card exercise ${open ? 'open' : ''} ${planned.skipped ? 'skipped' : ''}`}>
      <button className="exercise-head" onClick={onToggle}>
        <span>
          {planned.label && <span className="small muted">{planned.label}</span>}
          <strong className="exercise-name">{exercise.name}</strong>
          {!open && (
            <span className="small muted">
              {planned.sets} × {planned.repRange[0]}–{planned.repRange[1]} {valueUnit}
              {target.sets[0]?.loadKg !== undefined && ` · ${formatLoad(target.sets[0].loadKg, unit)}`}
            </span>
          )}
        </span>
        {status && <span className={`badge ${done ? 'ok' : ''}`}>{status}</span>}
      </button>

      {open && (
        <div className="stack">
          <div className="small muted">
            {planned.sets} séries · {planned.repRange[0]} à {planned.repRange[1]} {valueUnit}
            {exercise.unilateral && ' par côté'} · repos {formatRest(planned.restSec)}
          </div>
          {planned.note && <div className="small">{planned.note}</div>}
          {exercise.cues && <div className="small muted">{exercise.cues}</div>}

          <LastTime last={last} unit={unit} />
          <TargetLine target={target} unit={unit} />

          {sets.map((s, i) =>
            editing === s.id ? (
              <SetEditor
                key={s.id}
                title={`Série ${s.setNumber}`}
                unit={unit}
                exercise={exercise}
                initialLoad={s.loadKg ?? 0}
                initialValue={setValue(s, unit)}
                targetValue={s.targetReps ?? setValue(s, unit)}
                submitLabel="Enregistrer"
                onSubmit={async (loadKg, value) => {
                  await updateSet(s.id!, valueFields(unit, loadKg, value))
                  setEditing(null)
                }}
                onCancel={() => setEditing(null)}
                onDelete={async () => {
                  await deleteSet(s.id!)
                  setEditing(null)
                }}
              />
            ) : (
              <button key={s.id} className="set-row done" onClick={() => setEditing(s.id!)}>
                <span>Série {i + 1}</span>
                <strong>{formatSet(s.loadKg, setValue(s, unit), unit)}</strong>
                <span className="small muted">modifier</span>
              </button>
            ),
          )}

          {!done && !planned.skipped && editing === null && (
            <NextSet
              key={`${planned.exerciseId}-${sets.length}`}
              sessionId={sessionId}
              planned={planned}
              exercise={exercise}
              sets={sets}
              target={target}
              onValidated={onValidated}
            />
          )}

          {!done &&
            target.sets.slice(sets.length + 1).map((t, i) => (
              <div key={i} className="set-row pending">
                <span>Série {sets.length + i + 2}</span>
                <span className="muted">{formatSet(t.loadKg, t.value, unit)}</span>
              </div>
            ))}

          <div className="row card-actions">
            <button className="btn" onClick={() => onSets(planned.sets + 1)}>
              + Série
            </button>
            {planned.sets > Math.max(1, sets.length) && (
              <button className="btn" onClick={() => onSets(planned.sets - 1)}>
                − Série
              </button>
            )}
            {sets.length === 0 && (
              <button className="btn" onClick={onChange}>
                Changer
              </button>
            )}
            <button className="btn" onClick={onSkip}>
              {planned.skipped ? 'Reprendre' : 'Sauter'}
            </button>
            {!planned.templateKey && sets.length === 0 && (
              <button className="btn" onClick={onRemove}>
                Retirer
              </button>
            )}
            <button className="btn" onClick={() => onMove(-1)} disabled={first} aria-label="Monter">
              ↑
            </button>
            <button className="btn" onClick={() => onMove(1)} disabled={lastInPlan} aria-label="Descendre">
              ↓
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function LastTime({ last, unit }: { last?: LastPerformance; unit: LoadUnit }) {
  if (!last) return <div className="info">Jamais fait.</div>
  return (
    <div className="info">
      <div className="small muted">Dernière fois, {dayFormat.format(new Date(last.at))}</div>
      <div>{last.sets.map((s) => formatSet(s.loadKg, setValue(s, unit), unit)).join(' · ')}</div>
    </div>
  )
}

function TargetLine({ target, unit }: { target: Target; unit: LoadUnit }) {
  const loads = new Set(target.sets.map((s) => s.loadKg))
  const values = target.sets.map((s) => formatValue(s.value, unit)).join(' / ')
  const load = loads.size === 1 && target.sets[0].loadKg !== undefined ? formatLoad(target.sets[0].loadKg, unit) : ''
  return (
    <div className={`info target ${target.increased ? 'up' : ''}`}>
      <div>
        <strong>Cible :</strong> {load && `${load} × `}
        {values}
      </div>
      <div className="small">{target.reason}</div>
    </div>
  )
}

const valueFields = (unit: LoadUnit, loadKg: number, value: number) => ({
  loadKg: hasLoad(unit) ? loadKg : undefined,
  ...(unit === 'time' ? { durationSec: value, reps: undefined } : { reps: value, durationSec: undefined }),
})

function NextSet({
  sessionId,
  planned,
  exercise,
  sets,
  target,
  onValidated,
}: {
  sessionId: number
  planned: PlannedExercise
  exercise: Exercise
  sets: SetLog[]
  target: Target
  onValidated: (completed: boolean) => void
}) {
  const unit = exercise.loadUnit
  const n = sets.length
  const t = target.sets[Math.min(n, target.sets.length - 1)]
  // Charge préremplie : celle de la série précédente si je l'ai changée, sinon la cible.
  const initialLoad = sets[n - 1]?.loadKg ?? t?.loadKg ?? 0
  return (
    <SetEditor
      title={`Série ${n + 1}`}
      unit={unit}
      exercise={exercise}
      initialLoad={initialLoad}
      initialValue={t?.value ?? planned.repRange[0]}
      targetValue={t?.value ?? planned.repRange[0]}
      submitLabel={`Valider la série ${n + 1}`}
      onSubmit={async (loadKg, value) => {
        await logSet({
          sessionId,
          planKey: planned.key,
          templateKey: planned.templateKey,
          exerciseId: exercise.id,
          setNumber: n + 1,
          targetLoadKg: t?.loadKg,
          targetReps: t?.value,
          ...valueFields(unit, loadKg, value),
        })
        onValidated(n + 1 >= planned.sets)
      }}
    />
  )
}

function SetEditor({
  title,
  unit,
  exercise,
  initialLoad,
  initialValue,
  targetValue,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  title: string
  unit: LoadUnit
  exercise: Exercise
  initialLoad: number
  initialValue: number
  targetValue: number
  submitLabel: string
  onSubmit: (loadKg: number, value: number) => void
  onCancel?: () => void
  onDelete?: () => void
}) {
  const [load, setLoad] = useState(initialLoad)
  const [value, setValue] = useState(initialValue)
  const valueLabel = unit === 'time' ? 'Durée (s)' : exercise.unilateral ? 'Reps par côté' : 'Reps'
  const quick = [-2, -1, 0, 1, 2].map((d) => targetValue + d).filter((v) => v >= 0)

  return (
    <div className="set-editor">
      <div className="small muted">{title}</div>
      {hasLoad(unit) && (
        <Stepper
          label={unit === 'bodyweight+kg' ? 'Lest' : 'Charge'}
          value={load}
          step={exercise.loadIncrementKg ?? 2.5}
          bigStep={10}
          onChange={setLoad}
          format={(v) => (unit === 'bodyweight+kg' && v === 0 ? 'PDC' : `${v.toLocaleString('fr-FR')} kg`)}
        />
      )}
      <div className="stepper-label">{valueLabel}</div>
      <div className="chips quick">
        {quick.map((v) => (
          <button type="button" key={v} className={`chip ${value === v ? 'on' : ''}`} onClick={() => setValue(v)}>
            {v}
          </button>
        ))}
      </div>
      <Stepper label="" value={value} step={1} onChange={setValue} format={(v) => formatValue(v, unit)} />
      <button className="btn primary block big" onClick={() => onSubmit(load, value)}>
        {submitLabel}
      </button>
      {(onCancel || onDelete) && (
        <div className="row">
          {onCancel && (
            <button className="btn grow" onClick={onCancel}>
              Annuler
            </button>
          )}
          {onDelete && (
            <button className="btn grow danger" onClick={onDelete}>
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
