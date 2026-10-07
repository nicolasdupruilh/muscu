// Briques de saisie communes aux séances : éditeur de série, dernière fois, cible, choix du repos.
import { useState } from 'react'
import type { LoadUnit } from '../data/types'
import type { Exercise, SetLog } from '../db/models'
import type { Target } from '../logic/doubleProgression'
import { formatLoad, formatRest, formatSet, formatValue } from '../logic/format'
import { hasLoad, setValue } from '../logic/history'
import { REST_PRESETS, REST_STEP } from '../logic/rest'
import type { EntryMode } from '../logic/reps'
import { LoadStepper } from './LoadStepper'
import { Stepper } from './Stepper'

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

/** Saisie par défaut hors programme : durée pour un exercice en durée, reps sinon. */
export const defaultMode = (unit: LoadUnit): EntryMode => (unit === 'time' ? 'time' : 'reps')

/** Champs d'une série selon la saisie : reps, durée, ou simplement cochée. */
export const valueFields = (mode: EntryMode, unit: LoadUnit, loadKg: number, value: number) => ({
  loadKg: hasLoad(unit) ? loadKg : undefined,
  reps: mode === 'reps' ? value : undefined,
  durationSec: mode === 'time' ? value : undefined,
})

/** Une série réalisée en clair : « 30 kg × 10 », « 20 s », « Fait ». */
export function formatDone(s: Pick<SetLog, 'loadKg' | 'reps' | 'durationSec'>, unit: LoadUnit, mode: EntryMode): string {
  if (mode === 'check') return [formatLoad(s.loadKg, unit), 'fait'].filter(Boolean).join(' · ')
  return formatSet(s.loadKg, mode === 'time' ? s.durationSec ?? 0 : s.reps ?? 0, mode === 'time' ? 'time' : unit === 'time' ? 'none' : unit)
}

export function LastTime({ sets, unit, mode, label = 'Dernière fois' }: { sets?: SetLog[]; unit: LoadUnit; mode: EntryMode; label?: string }) {
  if (!sets?.length) return <div className="info">Jamais fait.</div>
  const at = sets.reduce((m, s) => (s.at > m ? s.at : m), '')
  return (
    <div className="info">
      <div className="small muted">
        {label}, {dayFormat.format(new Date(at))}
      </div>
      <div>{sets.map((s) => formatDone(s, unit, mode)).join(' · ')}</div>
    </div>
  )
}

export function TargetLine({ target, unit, mode }: { target: Target; unit: LoadUnit; mode: EntryMode }) {
  const loads = new Set(target.sets.map((s) => s.loadKg))
  const load = loads.size === 1 && target.sets[0].loadKg !== undefined ? formatLoad(target.sets[0].loadKg, unit) : ''
  const values = mode === 'check' ? '' : target.sets.map((s) => formatValue(s.value, mode === 'time' ? 'time' : 'kg')).join(' / ')
  if (!load && !values) return target.reason ? <div className="small muted">{target.reason}</div> : null
  return (
    <div className={`info target ${target.increased ? 'up' : ''}`}>
      <div>
        <strong>Cible :</strong> {[load, values].filter(Boolean).join(' × ')}
      </div>
      {target.reason && <div className="small">{target.reason}</div>}
    </div>
  )
}

/** Choix du repos avant un exercice : boutons rapides et réglage fin. */
export function RestChooser({ value, onChange }: { value: number; onChange: (sec: number) => void }) {
  return (
    <div className="rest-chooser">
      <div className="row">
        <span className="stepper-label grow">Repos</span>
        <button className="chip" onClick={() => onChange(Math.max(REST_STEP, value - REST_STEP))} aria-label="Repos moins 15 s">
          −15
        </button>
        <strong className="rest-value">{formatRest(value)}</strong>
        <button className="chip" onClick={() => onChange(value + REST_STEP)} aria-label="Repos plus 15 s">
          +15
        </button>
      </div>
      <div className="chips rest-presets">
        {REST_PRESETS.map((r) => (
          <button key={r} className={`chip ${value === r ? 'on' : ''}`} onClick={() => onChange(r)}>
            {formatRest(r)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Valeur initiale d'une série déjà saisie, pour la modifier. */
export const doneValue = (s: SetLog, mode: EntryMode) => (mode === 'time' ? s.durationSec ?? 0 : mode === 'reps' ? s.reps ?? 0 : setValue(s, 'none'))

export function SetEditor({
  title,
  unit,
  mode,
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
  mode: EntryMode
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
  const side = exercise.unilateral ? ' par côté' : ''
  const valueLabel = mode === 'time' ? `Durée (s)${side}` : `Reps${side}`
  const quickStep = mode === 'time' ? 5 : 1
  const quick = [-2, -1, 0, 1, 2].map((d) => targetValue + d * quickStep).filter((v) => v >= 0)

  return (
    <div className="set-editor">
      <div className="small muted">{title}</div>
      {hasLoad(unit) && (
        <LoadStepper
          label={unit === 'bodyweight+kg' ? 'Lest' : 'Charge'}
          value={load}
          step={exercise.loadIncrementKg ?? 2.5}
          onChange={setLoad}
          format={(v) => (unit === 'bodyweight+kg' && v === 0 ? 'PDC' : `${v.toLocaleString('fr-FR')} kg`)}
        />
      )}
      {mode !== 'check' && (
        <>
          <div className="stepper-label">{valueLabel}</div>
          <div className="chips quick">
            {quick.map((v) => (
              <button type="button" key={v} className={`chip ${value === v ? 'on' : ''}`} onClick={() => setValue(v)}>
                {v}
              </button>
            ))}
          </div>
          <Stepper label="" value={value} step={1} onChange={setValue} format={(v) => formatValue(v, mode === 'time' ? 'time' : 'kg')} />
        </>
      )}
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
