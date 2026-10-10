// Point d'entrée unique vers les fichiers de data/, intégrés à l'appli au moment du build.
import exercisesJson from '../../data/exercises.json'
import legsJson from '../../data/programme-jambes.json'
import absJson from '../../data/programme-abdos.json'
import upperBodyJson from '../../data/programme-haut-du-corps.json'
import planningJson from '../../data/planning.json'
import type { AbsProgramFile, ExercisesFile, LegProgramFile, PlanningFile, UpperBodyFile } from './types'
import { validateData } from './validate'
import type { ProgramShape } from '../logic/programs'
import type { LegPrescription, ProgramId } from '../db/models'
import { positionOf } from '../logic/programs'

export const dataErrors = validateData({
  exercises: exercisesJson,
  legs: legsJson,
  abs: absJson,
  upperBody: upperBodyJson,
})

export const catalogue = exercisesJson as unknown as ExercisesFile
export const legProgram = legsJson as unknown as LegProgramFile
export const absProgram = absJson as unknown as AbsProgramFile
export const upperBody = upperBodyJson as unknown as UpperBodyFile
export const planning = planningJson as unknown as PlanningFile

export const programShapes: Record<ProgramId, ProgramShape> = {
  jambes: { weeksCount: legProgram.weeksCount, sessionLabels: legProgram.sessionsPerWeek },
  // Deux séances avec abdos (après push et pull) font une semaine du programme abdos.
  abdos: { weeksCount: absProgram.weeksCount, sessionLabels: ['1re', '2e'] },
}

export const legWeek = (week: number) => legProgram.weeks.find((w) => w.week === week)

export const absBlockForWeek = (week: number) => absProgram.blocks.find((b) => week >= b.weeks[0] && week <= b.weeks[1])

/** Slots de la trame haut du corps, avec un libellé lisible (« Push · Développé incliné »). */
export const slotOptions: { slot: string; label: string }[] = (() => {
  const seen = new Map<string, string>()
  for (const t of upperBody.templates) {
    for (const s of t.variants.flatMap((v) => v.slots)) {
      // Deux places sur le même slot (Triceps 1 et 2) : un seul libellé, sans numéro.
      if (!seen.has(s.slot)) seen.set(s.slot, `${t.name} · ${s.label.replace(/\s\d$/, '')}`)
    }
  }
  return [...seen].map(([slot, label]) => ({ slot, label }))
})()

/** Version du programme jambes (1 si le fichier n'en indique pas). */
export const legProgramVersion = legProgram.version ?? 1

/** Copie de ce qui est prescrit à cette position du programme jambes, à enregistrer dans la séance. */
export function legPrescription(index: number, programVersion = legProgramVersion): LegPrescription | undefined {
  const pos = positionOf(programShapes.jambes, index)
  const week = legWeek(pos.week)
  const session = week?.sessions[pos.label]
  if (!week || !session) return undefined
  return { programVersion, name: session.name, week: pos.week, label: pos.label, blockName: week.blockName, deload: week.deload }
}

/** Séance jambes à une position du programme (nom et variantes). */
export function legSessionAt(index: number) {
  const pos = positionOf(programShapes.jambes, index)
  return legWeek(pos.week)?.sessions[pos.label]
}

export const upperTemplate = (type: 'push' | 'pull') => upperBody.templates.find((t) => t.id === type)!

/** Version de la trame haut du corps (1 si le fichier n'en indique pas). */
export const upperBodyVersion = upperBody.version ?? 1
