import { Link } from 'react-router'
import { StartUpperButton } from '../components/StartUpperButton'
import { useProgramStatus } from '../hooks'

export function ChoixSeance() {
  const legs = useProgramStatus('jambes')
  const abs = useProgramStatus('abdos')
  if (!legs || !abs) return null

  return (
    <>
      <h1>Choisir une séance</h1>
      <div className="card stack">
        {legs.next && (
          <Link className="btn block" to={`/seance/jambes/${legs.next.index}`}>
            Jambes · semaine {legs.next.week}, séance {legs.next.label}
          </Link>
        )}
        <StartUpperButton type="push" block />
        <StartUpperButton type="pull" block />
        {abs.next && (
          <Link className="btn block" to={`/seance/abdos/${abs.next.index}`}>
            Abdos seuls · semaine {abs.next.week}
          </Link>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        Séance libre : dans une prochaine étape.
      </p>
    </>
  )
}
