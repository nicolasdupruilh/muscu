// Point d'entrée unique vers les fichiers de data/, intégrés à l'appli au moment du build.
import exercisesJson from '../../data/exercises.json'
import legsJson from '../../data/programme-jambes.json'
import absJson from '../../data/programme-abdos.json'
import upperBodyJson from '../../data/programme-haut-du-corps.json'
import planningJson from '../../data/planning.json'
import type { AbsProgramFile, ExercisesFile, LegProgramFile, PlanningFile, UpperBodyFile } from './types'
import { validateData } from './validate'
import type { ProgramShape } from '../logic/programs'
import type { LegPrescription } from '../db/models'
import type { PhasePosition } from '../logic/phases'
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

/** Programme abdos : deux séances avec abdos (après push et pull) font une semaine. */
export const programShapes: { abdos: ProgramShape } = {
  abdos: { weeksCount: absProgram.weeksCount, sessionLabels: ['1re', '2e'] },
}

/** Ancien programme jambes (v1 à v3, 16 semaines × A et B) : pour relire les séances faites avec lui. */
export const OLD_LEG_SHAPE: ProgramShape = { weeksCount: 16, sessionLabels: ['A', 'B'] }

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

export const legPhase = (id: string) => legProgram.phases.find((p) => p.id === id)

/** Copie de ce qui est prescrit pour une séance jambes du programme par phases, à enregistrer dans la séance. */
export function legPrescription(pos: PhasePosition): LegPrescription {
  const w = pos.weekData
  return {
    programVersion: legProgramVersion,
    phaseId: pos.phase.id,
    phaseName: pos.phase.name,
    name: pos.session?.name ?? 'Jambes',
    week: pos.week ?? 0,
    label: pos.label,
    blockName: w?.blockName ?? pos.phase.name,
    deload: w?.deload ?? false,
  }
}

/** Séance jambes de l'ancien programme sans copie du prescrit (sauvegarde très ancienne) : semaine et séance seulement. */
export function oldLegPrescription(index: number): LegPrescription {
  const pos = positionOf(OLD_LEG_SHAPE, index)
  return { programVersion: 1, name: `Jambes ${pos.label}`, week: pos.week, label: pos.label, blockName: '', deload: false }
}

export const upperTemplate = (type: 'push' | 'pull') => upperBody.templates.find((t) => t.id === type)!

/** Version de la trame haut du corps (1 si le fichier n'en indique pas). */
export const upperBodyVersion = upperBody.version ?? 1
