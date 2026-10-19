import { useNavigate } from 'react-router'
import { startUpperSession } from '../db/sessions'

/** Démarre une séance push ou pull libre (ou reprend la séance déjà en cours). */
export function StartUpperButton({ type, primary, block }: { type: 'push' | 'pull'; primary?: boolean; block?: boolean }) {
  const navigate = useNavigate()
  return (
    <button
      className={`btn ${block ? 'block' : 'grow'} ${primary ? 'primary' : ''}`}
      onClick={async () => {
        await startUpperSession(type)
        navigate('/seance')
      }}
    >
      {type === 'push' ? 'Push' : 'Pull'}
    </button>
  )
}
