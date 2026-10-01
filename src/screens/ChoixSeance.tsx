import { useNavigate } from 'react-router'
import { StartUpperButton } from '../components/StartUpperButton'
import { startAbsSession, startLegSession } from '../db/sessions'
import { useProgramStatus } from '../hooks'

export function ChoixSeance() {
  const legs = useProgramStatus('jambes')
  const abs = useProgramStatus('abdos')
  const navigate = useNavigate()
  if (!legs || !abs) return null

  const start = (fn: () => Promise<number>) => async () => {
    await fn()
    navigate('/seance')
  }

  return (
    <>
      <h1>Choisir une séance</h1>
      <div className="card stack">
        {legs.next && (
          <button className="btn block" onClick={start(() => startLegSession(legs.next!.index))}>
            Jambes · semaine {legs.next.week}, séance {legs.next.label}
          </button>
        )}
        <StartUpperButton type="push" block />
        <StartUpperButton type="pull" block />
        {abs.next && (
          <button className="btn block" onClick={start(() => startAbsSession(abs.next!.index))}>
            Abdos seuls · semaine {abs.next.week}
          </button>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        Pour refaire ou sauter une séance jambes ou abdos, change la position du programme dans les réglages.
      </p>
    </>
  )
}
