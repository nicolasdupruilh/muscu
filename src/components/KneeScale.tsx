import { legProgram } from '../data'
import { kneeRule } from '../logic/knee'

/** Échelle de douleur 0 à 10, en gros boutons colorés selon le feu (vert / orange / rouge). */
export function KneeScale({ onPick }: { onPick: (value: number) => void }) {
  return (
    <div className="knee-scale">
      {Array.from({ length: 11 }, (_, v) => (
        <button key={v} className={`btn knee-btn ${kneeRule({ pendant: v }, legProgram.healthCheck.rules)?.level ?? ''}`} onClick={() => onPick(v)}>
          {v}
        </button>
      ))}
    </div>
  )
}
