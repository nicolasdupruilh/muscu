import { useEffect, useRef, useState } from 'react'
import { signal, unlockAudio } from '../alarm'
import { formatClock } from '../logic/rest'

/**
 * Compte à rebours d'une tenue (isométrique, gainage…), calculé depuis l'heure de fin : il reste juste si l'écran
 * se met en veille. Son et vibration à la fin.
 */
export function HoldTimer({
  seconds,
  label = 'Lancer la tenue',
  autoStart = false,
  onDone,
}: {
  seconds: number
  label?: string
  autoStart?: boolean
  onDone?: (seconds: number) => void
}) {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [done, setDone] = useState(false)
  const fired = useRef(false)

  const start = () => {
    unlockAudio()
    fired.current = false
    setDone(false)
    setEndsAt(Date.now() + seconds * 1000)
  }

  useEffect(() => {
    if (autoStart) start()
  }, [])

  useEffect(() => {
    if (endsAt === null) return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [endsAt])

  const left = endsAt === null ? seconds * 1000 : endsAt - now
  useEffect(() => {
    if (endsAt === null || left > 0 || fired.current) return
    fired.current = true
    signal()
    setEndsAt(null)
    setDone(true)
    onDone?.(seconds)
  }, [endsAt, left, seconds, onDone])

  if (endsAt === null) {
    return (
      <button type="button" className={`btn block hold-start ${done ? 'done' : ''}`} onClick={start}>
        {done ? `Tenue de ${seconds} s faite ✓ · relancer` : `${label} (${seconds} s)`}
      </button>
    )
  }
  return (
    <div className="hold-timer" role="timer" aria-live="polite">
      <div className="hold-clock">{formatClock(Math.max(0, left))}</div>
      <div className="rest-progress">
        <div style={{ width: `${Math.min(100, (1 - left / (seconds * 1000)) * 100)}%` }} />
      </div>
      <button type="button" className="link" onClick={() => setEndsAt(null)}>
        Arrêter
      </button>
    </div>
  )
}
