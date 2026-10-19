import { useNavigate } from 'react-router'
import { StartUpperButton } from '../components/StartUpperButton'
import { startAbsSession } from '../db/sessions'
import { usePhase, useProgramStatus } from '../hooks'

export function ChoixSeance() {
  const phase = usePhase()
  const abs = useProgramStatus('abdos')
  const navigate = useNavigate()
  if (!phase || !abs) return null
  const { pos } = phase

  return (
    <>
      <h1>Choisir une séance</h1>
      <div className="card stack">
        {!pos.finished && pos.session && (
          <button className="btn block" onClick={() => navigate('/demarrer/jambes')}>
            Jambes · {pos.phase.name.split(' :')[0]}
            {pos.week ? `, semaine ${pos.instance}` : ''}, séance {pos.label}
          </button>
        )}
        <StartUpperButton type="push" block />
        <StartUpperButton type="pull" block />
        {abs.next && (
          <button
            className="btn block"
            onClick={async () => {
              await startAbsSession(abs.next!.index)
              navigate('/seance')
            }}
          >
            Abdos · semaine {abs.next.week}
          </button>
        )}
        <button className="btn block" onClick={() => navigate('/volley')}>
          Volley
        </button>
        {pos.phase.daily && (
          <button className="btn block" onClick={() => navigate('/iso')}>
            Isométriques du jour
          </button>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        Pour changer de phase à la main, ou refaire une semaine abdos, va dans les réglages.
      </p>
    </>
  )
}
