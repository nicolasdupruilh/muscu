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

/** Un exercice prévu dans une séance : sa place dans la trame (ou hors trame), l'exercice choisi, la prescription. */
export interface PlannedExercise {
  /** Identifiant stable dans la séance (les séries y sont rattachées, même si l'ordre change). */
  key: string
  /** Position dans la trame, « push:0 »… ; absent pour un exercice hors trame. */
  templateKey?: string
  /** Slot de la trame (« triceps »…) : filtre la liste des exercices proposés. */
  slot?: string
  label?: string
  exerciseId: string
  sets: number
  /** Fourchette de reps (ou de secondes pour un exercice en durée). */
  repRange: [number, number]
  restSec: number
  note?: string
  skipped?: boolean
  /** J'ai choisi d'ignorer l'ajustement de cible lié à un repos plus court. */
  ignoreRestAdjust?: boolean
}

/** Chrono de repos en cours. Calculé à partir de l'heure de fin, pas d'un compteur. */
export interface RestTimer {
  /** Exercice après lequel le repos a démarré. */
  planKey: string
  startedAt: string
  endsAt: string
  /** Repos terminé (« Passer », « C'est parti ») : sert à mesurer le repos réellement pris. */
  endedAt?: string
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
  /** Exercices prévus, dans l'ordre (séances haut du corps et libres). */
  plan?: PlannedExercise[]
  rest?: RestTimer
  notes?: string
  kneeCheck?: KneeCheck
}

export interface SetLog {
  id?: number
  sessionId: number
  exerciseId: string
  /** PlannedExercise.key auquel la série appartient. */
  planKey: string
  /** Position dans la trame (« push:0 »…), pour retrouver l'exercice fait la dernière fois à cette place. */
  templateKey?: string
  setNumber: number
  targetLoadKg?: number
  targetReps?: number
  loadKg?: number
  /** Reps réalisées ; pour un exercice unilatéral, par côté. */
  reps?: number
  /** Durée réalisée, pour un exercice en durée (loadUnit « time »). */
  durationSec?: number
  /** Repos choisi pour cet exercice (prérempli la fois suivante). */
  restPlannedSec?: number
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
