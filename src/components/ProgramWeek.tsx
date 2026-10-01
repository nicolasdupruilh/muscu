import type { Position, ProgramStatus } from '../logic/programs'

/** Séances de la semaine en cours d'un programme cadré : faites, à faire, prochaine. */
export function ProgramWeek({
  status,
  labelOf,
  detailOf,
}: {
  status: ProgramStatus
  labelOf: (p: Position) => string
  detailOf?: (p: Position) => string | undefined
}) {
  return (
    <div className="stack">
      {status.week.map((w) => (
        <div key={w.position.index} className={`session-line ${w.next ? 'next' : ''}`}>
          <div>
            <strong>{labelOf(w.position)}</strong>
            {detailOf && <div className="small muted">{detailOf(w.position)}</div>}
          </div>
          <span className={`badge ${w.done ? 'ok' : ''}`}>{w.done ? 'Faite ✓' : w.skipped ? 'Passée' : w.next ? 'Prochaine' : 'À faire'}</span>
        </div>
      ))}
    </div>
  )
}
