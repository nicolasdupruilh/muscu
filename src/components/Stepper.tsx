/** Valeur réglable au pouce : gros boutons − et +, sans clavier. */
export function Stepper({
  label,
  value,
  onChange,
  step,
  bigStep,
  min = 0,
  format = (v) => String(v),
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step: number
  /** Grand pas optionnel (boutons −10 / +10), pour aller vite à une charge éloignée. */
  bigStep?: number
  min?: number
  format?: (v: number) => string
}) {
  // Arrondi pour éviter 2.5 + 1.25 = 3.7499999…
  const set = (v: number) => onChange(Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="stepper">
      <div className="stepper-label">{label}</div>
      <div className="stepper-row">
        <button type="button" className="btn stepper-btn" onClick={() => set(value - step)} aria-label={`${label} moins`}>
          −
        </button>
        <div className="stepper-value">{format(value)}</div>
        <button type="button" className="btn stepper-btn" onClick={() => set(value + step)} aria-label={`${label} plus`}>
          +
        </button>
      </div>
      {bigStep && (
        <div className="stepper-big">
          <button type="button" className="chip" onClick={() => set(value - bigStep)}>
            −{bigStep}
          </button>
          <button type="button" className="chip" onClick={() => set(value + bigStep)}>
            +{bigStep}
          </button>
        </div>
      )}
    </div>
  )
}
