import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { unlockAudio } from '../alarm'
import { ExercisePicker } from '../components/ExercisePicker'
import { KneeScale } from '../components/KneeScale'
import { defaultMode, doneValue, formatDone, LastTime, RestChooser, SetEditor, TargetLine, valueFields } from '../components/SetEntry'
import { legProgram, legWeek, programShapes } from '../data'
import type { Exercise, PlannedExercise, Session, SetLog } from '../db/models'
import {
  abandonSession,
  deleteSet,
  finishLegSession,
  finishSession,
  logSet,
  startAbsSession,
  updatePlan,
  updateSet,
} from '../db/sessions'
import { useActiveSession, useExercises, useProgramStatus, useSetLogs } from '../hooks'
import { doubleProgression, type Target } from '../logic/doubleProgression'
import { formatKg, formatLoad, formatRest } from '../logic/format'
import { hasLoad, lastPerformance, toPastSets, type LastPerformance } from '../logic/history'
import { positionOf } from '../logic/programs'
import { describeReps, entryMode, parseReps, type EntryMode } from '../logic/reps'
import { applyRestAdjustment, lastChosenRest, lastRestReference, restAdjustment } from '../logic/rest'
import { legTarget } from '../logic/structuredPlans'
import { describeTempo } from '../logic/tempo'
import { AbsCircuit } from './AbsCircuit'
import { ChoixSeance } from './ChoixSeance'

const typeNames: Record<string, string> = { push: 'Push', pull: 'Pull', libre: 'Séance libre' }
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

type PickerState = { mode: 'change'; key: string } | { mode: 'add' } | null

/** Saisie d'un exercice : selon la prescription pour une séance cadrée, selon l'unité sinon. */
export const modeOf = (planned: PlannedExercise, exercise: Exercise): EntryMode =>
  planned.prescribedReps !== undefined ? entryMode(parseReps(planned.prescribedReps), exercise.loadUnit) : defaultMode(exercise.loadUnit)

/** Écran /seance : la séance en cours, ou le choix d'une séance s'il n'y en a pas. */
export function Seance() {
  const session = useActiveSession()
  if (session === undefined) return null
  if (!session) return <ChoixSeance />
  return session.type === 'abdos' ? <AbsCircuit session={session} /> : <SeanceEnCours session={session} />
}

function SeanceEnCours({ session }: { session: Session }) {
  const exercises = useExercises()
  const logs = useSetLogs()
  const abs = useProgramStatus('abdos')
  const navigate = useNavigate()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickerState>(null)
  const [kneeCheck, setKneeCheck] = useState(false)
  if (!exercises || !logs || !abs) return null

  const id = session.id!
  const isLegs = session.type === 'jambes'
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

  const finish = async () => {
    if (remaining > 0 && !confirm('Il reste des exercices non terminés. Terminer la séance quand même ?')) return
    if (isLegs) return setKneeCheck(true)
    await finishSession(id)
    // Les abdos s'enchaînent après un push ou un pull.
    if ((session.type === 'push' || session.type === 'pull') && abs.next) {
      await startAbsSession(abs.next.index, id)
      window.scrollTo(0, 0)
    } else {
      navigate('/')
    }
  }

  if (kneeCheck) {
    return (
      <>
        <h1>Check genou</h1>
        <p>{legProgram.healthCheck.questions.find((q) => q.id === 'pendant')?.label ?? 'Douleur pendant la séance'}, de 0 à 10 :</p>
        <KneeScale
          onPick={async (value) => {
            await finishLegSession(id, value)
            navigate('/')
          }}
        />
        <button className="link" onClick={() => setKneeCheck(false)}>
          Retour à la séance
        </button>
      </>
    )
  }

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
            // Nouvel exercice : son repos de la dernière fois, sinon celui de la place.
            const restSec = lastChosenRest(logs, exerciseId, id) ?? pickerTarget.restSec
            await patch(pickerTarget.key, { exerciseId, restSec, ignoreRestAdjust: false })
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
                restSec: lastChosenRest(logs, exerciseId, id) ?? (ex?.defaultRestSec || 90),
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
      {isLegs ? <LegHeader session={session} /> : <h1>{typeNames[session.type] ?? session.type}</h1>}
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
            othersRemaining={plan.some((q) => q.key !== p.key && !q.skipped && !isComplete(q))}
            onToggle={() => setOpenKey(open === p.key ? '' : p.key)}
            onChange={p.prescribedReps === undefined ? () => setPicker({ mode: 'change', key: p.key }) : undefined}
            onMove={(dir) => move(p.key, dir)}
            onSkip={() => {
              patch(p.key, { skipped: !p.skipped })
              setOpenKey(null)
            }}
            onRemove={() => updatePlan(id, (pl) => pl.filter((x) => x.key !== p.key))}
            onSets={(sets) => patch(p.key, { sets })}
            onRest={(restSec) => patch(p.key, { restSec })}
            onIgnoreRestAdjust={(ignore) => patch(p.key, { ignoreRestAdjust: ignore })}
            onValidated={(completed) => completed && setOpenKey(null)}
          />
        )
      })}

      <button className="btn block" style={{ marginTop: 16 }} onClick={() => setPicker({ mode: 'add' })}>
        + Ajouter un exercice {isLegs ? 'hors programme' : 'hors trame'}
      </button>

      <div className="stack" style={{ marginTop: 24 }}>
        <button className="btn primary block" onClick={finish}>
          {isLegs ? 'Terminer et faire le check genou' : abs.next ? 'Terminer et enchaîner les abdos' : 'Terminer la séance'}
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

/** En-tête d'une séance jambes : semaine, bloc, semaine allégée, ajustement genou, règle de charge. */
function LegHeader({ session }: { session: Session }) {
  const pos = positionOf(programShapes.jambes, session.program?.index ?? 0)
  const week = legWeek(pos.week)
  const rule = session.kneeAdjustment && legProgram.healthCheck.rules.find((r) => r.level === session.kneeAdjustment)
  return (
    <>
      <h1>{week?.sessions[pos.label]?.name ?? 'Jambes'}</h1>
      <p className="muted">
        Semaine {pos.week} · {week?.blockName} {week?.deload && <span className="badge warn">Semaine allégée</span>}
      </p>
      {rule && (
        <div className={`card knee ${rule.level}`}>
          <strong>Genou {rule.level} à la dernière séance.</strong>
          <div className="small">{rule.action}</div>
          <div className="small muted">Les ajustements sont appliqués ci-dessous ; tu peux les annuler exercice par exercice.</div>
        </div>
      )}
      <details className="small muted">
        <summary>Règle de charge</summary>
        {legProgram.loadRule}
      </details>
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
  othersRemaining,
  onToggle,
  onChange,
  onMove,
  onSkip,
  onRemove,
  onSets,
  onRest,
  onIgnoreRestAdjust,
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
  /** D'autres exercices restent à faire après celui-ci. */
  othersRemaining: boolean
  onToggle: () => void
  /** Absent pour un exercice prescrit par le programme. */
  onChange?: () => void
  onMove: (dir: -1 | 1) => void
  onSkip: () => void
  onRemove: () => void
  onSets: (n: number) => void
  onRest: (sec: number) => void
  onIgnoreRestAdjust: (ignore: boolean) => void
  onValidated: (completed: boolean) => void
}) {
  const [editing, setEditing] = useState<number | null>(null)
  const [showRest, setShowRest] = useState(false)
  const ref = useRef<HTMLElement>(null)
  // L'exercice qui s'ouvre vient se placer en haut de l'écran.
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [open])

  const unit = exercise.loadUnit
  const mode = modeOf(planned, exercise)
  const prescribed = planned.prescribedReps !== undefined
  const pastSets = last ? toPastSets(last.sets, unit) : []
  let target: Target
  let adjustment: ReturnType<typeof restAdjustment> | undefined
  if (prescribed) {
    target = legTarget(planned, pastSets, unit)
  } else {
    const progression = doubleProgression({
      last: pastSets,
      repRange: planned.repRange,
      sets: planned.sets,
      incrementKg: hasLoad(unit) ? exercise.loadIncrementKg ?? 2.5 : undefined,
      unit: unit === 'time' ? 's' : 'reps',
    })
    // Repos nettement plus court que la dernière fois : cible revue à la baisse (ignorable).
    adjustment = last && restAdjustment(planned.restSec, lastRestReference(last.sets))
    target = adjustment && !planned.ignoreRestAdjust ? applyRestAdjustment(progression, pastSets, adjustment) : progression
  }
  const done = sets.length >= planned.sets
  const status = planned.skipped ? 'Sautée' : done ? 'Fait ✓' : sets.length ? `${sets.length}/${planned.sets}` : ''
  const prescription = prescribed
    ? describeReps(parseReps(planned.prescribedReps!))
    : `${planned.repRange[0]} à ${planned.repRange[1]} ${unit === 'time' ? 's' : 'reps'}${exercise.unilateral ? ' par côté' : ''}`
  const loadHint = target.sets[0]?.loadKg !== undefined ? formatLoad(target.sets[0].loadKg, unit) : ''

  return (
    <section ref={ref} className={`card exercise ${open ? 'open' : ''} ${planned.skipped ? 'skipped' : ''}`}>
      <button className="exercise-head" onClick={onToggle}>
        <span>
          {planned.label && <span className="small muted">{planned.label}</span>}
          <strong className="exercise-name">{exercise.name}</strong>
          {!open && (
            <span className="small muted">
              {planned.sets} × {prescription}
              {loadHint && ` · ${loadHint}`}
            </span>
          )}
        </span>
        {status && <span className={`badge ${done ? 'ok' : ''}`}>{status}</span>}
      </button>

      {open && (
        <div className="stack">
          <div>
            <strong>
              {planned.sets} × {prescription}
            </strong>
            {planned.targetLoadKg !== undefined && <> · {formatKg(planned.targetLoadKg)}</>}
            {planned.restSec > 0 && <span className="muted"> · repos {formatRest(planned.restSec)}</span>}
          </div>
          {planned.tempo && (
            <div className="small">
              Tempo {planned.tempo} : {describeTempo(planned.tempo)}
            </div>
          )}
          {planned.adjustmentNote && <div className="info adjust">{planned.adjustmentNote}</div>}
          {planned.note && !(planned.tempo && sameStart(describeTempo(planned.tempo), planned.note)) && <div className="small">{planned.note}</div>}
          {exercise.cues && !sameStart(exercise.cues, planned.note) && <div className="small muted">{exercise.cues}</div>}

          {/* Rien à comparer pour une série simplement cochée, sans charge (échauffement). */}
          {(mode !== 'check' || hasLoad(unit)) && (
            <>
              <LastTime sets={last?.sets} unit={unit} mode={mode} />
              <TargetLine target={target} unit={unit} mode={mode} />
            </>
          )}
          {adjustment && (
            <button className="link" onClick={() => onIgnoreRestAdjust(!planned.ignoreRestAdjust)}>
              {planned.ignoreRestAdjust ? 'Réappliquer l’ajustement au repos plus court' : 'Ignorer cet ajustement'}
            </button>
          )}
          {!done &&
            planned.restSec > 0 &&
            (sets.length === 0 || showRest ? (
              <RestChooser value={planned.restSec} onChange={onRest} />
            ) : (
              <div className="small muted">
                Repos {formatRest(planned.restSec)} ·{' '}
                <button className="link inline" onClick={() => setShowRest(true)}>
                  modifier
                </button>
              </div>
            ))}

          {sets.map((s, i) =>
            editing === s.id ? (
              <SetEditor
                key={s.id}
                title={`Série ${s.setNumber}`}
                unit={unit}
                mode={mode}
                exercise={exercise}
                initialLoad={s.loadKg ?? 0}
                initialValue={doneValue(s, mode)}
                targetValue={s.targetReps ?? doneValue(s, mode)}
                submitLabel="Enregistrer"
                onSubmit={async (loadKg, value) => {
                  await updateSet(s.id!, valueFields(mode, unit, loadKg, value))
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
                <strong>{formatDone(s, unit, mode)}</strong>
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
              mode={mode}
              sets={sets}
              target={target}
              othersRemaining={othersRemaining}
              onValidated={onValidated}
            />
          )}

          {!done &&
            mode !== 'check' &&
            target.sets.slice(sets.length + 1).map((t, i) => (
              <div key={i} className="set-row pending">
                <span>Série {sets.length + i + 2}</span>
                <span className="muted">{formatDone({ loadKg: t.loadKg, reps: t.value, durationSec: t.value }, unit, mode)}</span>
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
            {onChange && sets.length === 0 && (
              <button className="btn" onClick={onChange}>
                Changer
              </button>
            )}
            <button className="btn" onClick={onSkip}>
              {planned.skipped ? 'Reprendre' : 'Sauter'}
            </button>
            {planned.key.startsWith('extra:') && sets.length === 0 && (
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

/** La consigne du catalogue redit la note du programme (même début) : inutile de l'afficher deux fois. */
const sameStart = (a: string, b?: string) => !!b && a.slice(0, 15).toLowerCase() === b.slice(0, 15).toLowerCase()

function NextSet({
  sessionId,
  planned,
  exercise,
  mode,
  sets,
  target,
  othersRemaining,
  onValidated,
}: {
  sessionId: number
  planned: PlannedExercise
  exercise: Exercise
  mode: EntryMode
  sets: SetLog[]
  target: Target
  othersRemaining: boolean
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
      mode={mode}
      exercise={exercise}
      initialLoad={initialLoad}
      initialValue={t?.value ?? planned.repRange[0]}
      targetValue={t?.value ?? planned.repRange[0]}
      submitLabel={mode === 'check' ? `Série ${n + 1} faite` : `Valider la série ${n + 1}`}
      onSubmit={async (loadKg, value) => {
        unlockAudio()
        const completed = n + 1 >= planned.sets
        // Le chrono démarre, sauf après la toute dernière série de la séance ou sans repos prévu.
        const restSec = (!completed || othersRemaining) && planned.restSec > 0 ? planned.restSec : undefined
        await logSet(
          {
            sessionId,
            planKey: planned.key,
            templateKey: planned.templateKey,
            exerciseId: exercise.id,
            setNumber: n + 1,
            targetLoadKg: t?.loadKg,
            targetReps: mode === 'check' ? undefined : t?.value,
            restPlannedSec: planned.restSec,
            ...valueFields(mode, unit, loadKg, value),
          },
          restSec,
        )
        onValidated(completed)
      }}
    />
  )
}
