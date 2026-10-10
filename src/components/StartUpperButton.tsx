import { useNavigate } from 'react-router'

/** Démarre une séance push ou pull : écran « Combien de temps tu as ? », ou la séance déjà en cours. */
export function StartUpperButton({ type, primary, block }: { type: 'push' | 'pull'; primary?: boolean; block?: boolean }) {
  const navigate = useNavigate()
  return (
    <button className={`btn ${block ? 'block' : 'grow'} ${primary ? 'primary' : ''}`} onClick={() => navigate(`/demarrer/${type}`)}>
      {type === 'push' ? 'Push' : 'Pull'}
    </button>
  )
}
