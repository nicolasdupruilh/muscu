import { useSessions } from '../hooks'
import { formatDay } from '../logic/dates'

const typeLabels: Record<string, string> = {
  jambes: 'Jambes',
  push: 'Push',
  pull: 'Pull',
  abdos: 'Abdos',
  libre: 'Séance libre',
  course: 'Footing',
}

export function Historique() {
  const sessions = useSessions()
  if (!sessions) return null
  const done = sessions.filter((s) => s.status === 'terminee').reverse()

  return (
    <>
      <h1>Historique</h1>
      {done.length === 0 ? (
        <p className="muted">Aucune séance pour l'instant.</p>
      ) : (
        <ul className="list card">
          {done.map((s) => (
            <li key={s.id}>
              <strong>{typeLabels[s.type] ?? s.type}</strong>
              <div className="small muted">{formatDay(new Date(s.date))}</div>
            </li>
          ))}
        </ul>
      )}
      <p className="small muted" style={{ marginTop: 12 }}>
        Détail des séances et courbes : dans une prochaine étape.
      </p>
    </>
  )
}
