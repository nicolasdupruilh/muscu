import type { CatalogueExercise } from '../data/types'

export interface Exercise extends CatalogueExercise {
  /** « catalogue » : vient de data/exercises.json ; « user » : créé dans l'appli. */
  source: 'catalogue' | 'user'
  /** Modifié dans l'appli : la synchronisation du catalogue ne l'écrase plus. */
  userModified: boolean
  archived: boolean
}

export type SessionType = 'jambes' | 'push' | 'pull' | 'abdos' | 'libre' | 'course'

export type ProgramId = 'jambes' | 'abdos'

/** Position dans un programme cadré : rang 0, 1, 2… dans la suite des séances (voir logic/programs.ts). */
export interface ProgramPosition {
  programId: ProgramId
  index: number
}

export interface KneeCheck {
  /** Douleur pendant la séance, 0 à 10. */
  pendant?: number
  /** Squat unipodal lent le lendemain matin, 0 à 10. */
  lendemain?: number
  lendemainAt?: string
}

export interface Session {
  id?: number
  /** Début de la séance, ISO. */
  date: string
  endedAt?: string
  type: SessionType
  status: 'en-cours' | 'terminee'
  /** Renseigné pour les séances cadrées (jambes, abdos). */
  program?: ProgramPosition
  /** Pour une séance abdos enchaînée après un push ou un pull. */
  parentSessionId?: number
  notes?: string
  kneeCheck?: KneeCheck
}

export interface SetLog {
  id?: number
  sessionId: number
  exerciseId: string
  /** Ordre de l'exercice dans la séance. */
  exerciseOrder: number
  /** Slot de la trame haut du corps, si l'exercice y a été choisi. */
  slot?: string
  setNumber: number
  targetLoadKg?: number
  targetReps?: number
  loadKg?: number
  /** Reps réalisées ; pour un exercice unilatéral, par côté. */
  reps?: number
  durationSec?: number
  /** Repos réellement pris avant la série. */
  restTakenSec?: number
  done: boolean
  /** Heure de validation, ISO. */
  at: string
}

export interface ProgramSettings {
  /** Date de début, AAAA-MM-JJ (information seulement : la progression suit les séances faites). */
  startDate?: string
  /** Correction manuelle : « reprendre à cette position » à partir de cet instant. */
  override?: { index: number; at: string }
}

export interface Settings {
  id: 'main'
  programs: Record<ProgramId, ProgramSettings>
}

export const defaultSettings = (): Settings => ({
  id: 'main',
  programs: { jambes: {}, abdos: {} },
})
