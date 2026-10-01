// Séance abdos en circuit : un tour = une série de chaque exercice, sans repos ; repos entre les tours.
import { useNavigate } from 'react-router'
import { unlockAudio } from '../alarm'
import { formatDone, LastTime, SetEditor, TargetLine, valueFields } from '../components/SetEntry'
import { absBlockForWeek, absProgram, programShapes } from '../data'
import type { Exercise, PlannedExercise, Session, SetLog } from '../db/models'
import { abandonSession, finishSession, logSet, updatePlan } from '../db/sessions'
import { useExercises, useSessions, useSetLogs } from '../hooks'
import { formatRest } from '../logic/format'
import { lastPerformance } from '../logic/history'
import { positionOf } from '../logic/programs'
import { describeReps, entryMode, parseReps } from '../logic/reps'
import { absTarget, circuitNext, circuitRounds } from '../logic/structuredPlans'

export function AbsCircuit({ session }: { session: Session }) {
  const exercises = useExercises()
  const logs = useSetLogs()
  const sessions = useSessions()
  const navigate = useNavigate()
  if (!exercises || !logs || !sessions) return null

  const id = session.id!
  const pos = positionOf(programShapes.abdos, session.program?.index ?? 0)
  const block = absBlockForWeek(pos.week)
  const plan = session.plan ?? []
  const sessionLogs = logs.filter((l) => l.sessionId === id)
  const setsOf = (key: string) => sessionLogs.filter((l) => l.planKey === key).sort((a, b) => a.setNumber - b.setNumber)
  const next = circuitNext(plan, (k) => setsOf(k).length)
  const rounds = circuitRounds(plan)

  // Progression dans un bloc : on compare à la dernière séance abdos du même bloc.
  const blockSessions = new Set(
    sessions
      .filter((s) => s.type === 'abdos' && s.status === 'terminee' && s.id !== id && s.program)
      .filter((s) => {
        const w = positionOf(programShapes.abdos, s.program!.index).week
        return block !== undefined && w >= block.weeks[0] && w <= block.weeks[1]
      })
      .map((s) => s.id),
  )
  const blockLogs = logs.filter((l) => blockSessions.has(l.sessionId))

  const patch = (key: string, changes: Partial<PlannedExercise>) =>
    updatePlan(id, (pl) => pl.map((p) => (p.key === key ? { ...p, ...changes } : p)))

  const finish = async () => {
    if (next && !confirm('Le circuit n’est pas terminé. Terminer quand même ?')) return
    if (sessionLogs.length === 0) await abandonSession(id)
    else await finishSession(id)
    navigate('/')
  }

  return (
    <>
      <h1>Abdos</h1>
      <p className="muted">
        Semaine {pos.week} · {pos.label} séance · {next ? `tour ${next.round} / ${rounds}` : 'circuit terminé'}
      </p>
      <p className="small muted">
        Enchaîne les exercices d’un tour sans pause, puis {formatRest(absProgram.restBetweenRoundsSec)} de repos entre les tours.
      </p>

      {plan.map((p) => {
        const ex = exercises.get(p.exerciseId)
        if (!ex) return null
        return (
          <CircuitItem
            key={p.key}
            sessionId={id}
            planned={p}
            exercise={ex}
            sets={setsOf(p.key)}
            lastInBlock={lastPerformance(blockLogs, p.exerciseId)?.sets ?? []}
            lastAny={lastPerformance(logs, p.exerciseId, id)?.sets}
            current={next?.key === p.key ? next.round : undefined}
            restAfter={() => {
              // Repos seulement à la fin d'un tour, s'il en reste un.
              const after = circuitNext(plan, (k) => setsOf(k).length + (k === p.key ? 1 : 0))
              return after && next && after.round > next.round ? absProgram.restBetweenRoundsSec : undefined
            }}
            onSkip={() => patch(p.key, { skipped: !p.skipped })}
          />
        )
      })}

      <div className="stack" style={{ marginTop: 24 }}>
        <button className={`btn block ${next ? '' : 'primary'}`} onClick={finish}>
          {sessionLogs.length === 0 ? 'Passer les abdos' : 'Terminer les abdos'}
        </button>
      </div>
    </>
  )
}

function CircuitItem({
  sessionId,
  planned,
  exercise,
  sets,
  lastInBlock,
  lastAny,
  current,
  restAfter,
  onSkip,
}: {
  sessionId: number
  planned: PlannedExercise
  exercise: Exercise
  sets: SetLog[]
  lastInBlock: SetLog[]
  lastAny?: SetLog[]
  /** Tour en cours si c'est l'exercice à faire maintenant. */
  current?: number
  restAfter: () => number | undefined
  onSkip: () => void
}) {
  const unit = exercise.loadUnit
  const parsed = parseReps(planned.prescribedReps ?? planned.repRange[0])
  const mode = entryMode(parsed, unit)
  const target = absTarget(planned, lastInBlock, unit, mode === 'time')
  const t = target.sets[0]
  const done = sets.length >= planned.sets

  return (
    <section className={`card exercise ${current ? 'open' : ''} ${planned.skipped ? 'skipped' : ''}`}>
      <div className="exercise-head">
        <span>
          <strong className="exercise-name">{exercise.name}</strong>
          <span className="small muted">
            {planned.sets} tours × {describeReps(parsed)}
          </span>
        </span>
        <span className="rounds" aria-label={`${sets.length} tours sur ${planned.sets}`}>
          {Array.from({ length: planned.sets }, (_, i) => (
            <span key={i} className={`dot ${i < sets.length ? 'on' : ''}`} />
          ))}
        </span>
      </div>
      <div className="stack">
        {planned.note && <div className="small">{planned.note}</div>}
        {current && (
          <>
            <LastTime sets={lastAny} unit={unit} mode={mode} />
            <TargetLine target={target} unit={unit} mode={mode} />
            <SetEditor
              key={`${planned.key}-${current}`}
              title={`Tour ${current}`}
              unit={unit}
              mode={mode}
              exercise={exercise}
              initialLoad={sets[sets.length - 1]?.loadKg ?? t.loadKg ?? 0}
              initialValue={t.value}
              targetValue={t.value}
              submitLabel="Valider"
              onSubmit={async (loadKg, value) => {
                unlockAudio()
                await logSet(
                  {
                    sessionId,
                    planKey: planned.key,
                    exerciseId: exercise.id,
                    setNumber: current,
                    targetLoadKg: t.loadKg,
                    targetReps: mode === 'check' ? undefined : t.value,
                    ...valueFields(mode, unit, loadKg, value),
                  },
                  restAfter(),
                )
              }}
            />
          </>
        )}
        {sets.length > 0 && !current && <div className="small muted">{sets.map((s) => formatDone(s, unit, mode)).join(' · ')}</div>}
        {!done && (
          <div className="row card-actions">
            <button className="btn" onClick={onSkip}>
              {planned.skipped ? 'Reprendre' : 'Sauter'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
