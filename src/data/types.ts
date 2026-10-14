// Types des fichiers de data/. Ces fichiers sont la source de vérité : on les décrit, on ne les recopie pas.

export type LoadUnit = 'kg' | 'bodyweight' | 'bodyweight+kg' | 'time' | 'none'

export interface CatalogueExercise {
  id: string
  name: string
  category: string
  equipment: string
  loadUnit: LoadUnit
  unilateral: boolean
  defaultRestSec: number
  slots: string[]
  cues: string
  loadIncrementKg?: number
  /** Exercices proposés en remplacement pendant une séance cadrée. */
  alternatives?: string[]
}

export interface ExercisesFile {
  version: number
  note?: string
  exercises: CatalogueExercise[]
}

/** Reps prescrites : un nombre, ou un texte (« 8/côté », « 6-8 », « 20 s », « 15 m »…). */
export type Reps = number | string

export interface LegItem {
  exerciseId: string
  sets: number
  reps: Reps
  note: string
  restSec: number
  targetLoadKg?: number
  tempo?: string
  /** Les exercices qui partagent la même valeur s'enchaînent sans pause (superset). */
  superset?: string
  /** Exercice optionnel, proposé seulement si la condition est remplie (ex. « semaine>=2 et lendemain<=2 »). */
  condition?: string
}

/** Variante d'une séance selon le temps disponible, de la plus courte à la complète. */
export interface Variant {
  id: string
  label: string
  /** Durée estimée en minutes (abdos compris pour le haut du corps). */
  estimatedMin: number
}

export interface LegVariant extends Variant {
  items: LegItem[]
}

export interface LegSession {
  name: string
  variants: LegVariant[]
}

/** Semaine d'une phase. En phase 4, elle reprend un bloc de l'ancien programme (bloc, semaine allégée). */
export interface LegWeek {
  week: number
  block?: number
  blockName?: string
  deload?: boolean
  oldBlock?: number
  sessions: Record<string, LegSession>
}

/** Critère de sortie d'une phase : échelle 0-10 (valeur ≤ max), oui/non, ratio droite/gauche (≥ min), ou calculé (auto). */
export interface ExitCriterion {
  id: string
  label: string
  type?: 'scale' | 'yesno' | 'ratio' | 'auto'
  max?: number
  min?: number
}

export interface VolleyStep {
  step: number
  label: string
}

/** Isométriques à faire tous les jours pendant la phase. */
export interface DailyItem {
  exerciseId: string
  sets: number
  reps: Reps
  restSec: number
  note?: string
}

export interface LegPhase {
  id: string
  name: string
  goal: string
  rules: string[]
  /** Durée minimale avant le test de sortie : en jours (phase 0) ou en semaines du programme. */
  minDays?: number
  minWeeks?: number
  /** Au-delà, la phase dure anormalement longtemps : conseil de consulter. */
  maxWeeks?: number
  daily?: DailyItem[]
  /** Séances fixes, sans semaines (phase 0). */
  sessions?: Record<string, LegSession>
  /** Séances par semaine (phase 0 : ["A", "A"]). */
  sessionsPerWeek?: string[]
  weeks?: LegWeek[]
  /** Après la dernière semaine, on la répète tant que les critères de sortie ne sont pas remplis. */
  repeatLastWeek?: boolean
  exitCriteria?: ExitCriterion[]
  volleyLadder?: VolleyStep[]
}

export interface HealthRule {
  max: number
  level: 'vert' | 'orange' | 'rouge'
  action: string
}

export interface HealthQuestion {
  id: string
  label: string
  scale: [number, number]
  askNextDay?: boolean
}

export interface LegProgramFile {
  id: string
  name: string
  type: 'phased'
  tempoNotation: string
  healthCheck: {
    id: string
    label: string
    /** Types de séance concernés (jambes, volley). */
    appliesTo?: string[]
    questions: HealthQuestion[]
    rules: HealthRule[]
    /** Réponse sur laquelle se prend la décision vert / orange / rouge. */
    decisionOn?: 'lendemain'
    note: string
  }
  /** Version du programme, incrémentée à chaque modification (voir PRINCIPES.md). Absente = version 1. */
  version?: number
  changelog?: string[]
  variantRule?: string
  supersetRule?: string
  phaseRule?: string
  phases: LegPhase[]
}

export interface AbsItem {
  exerciseId: string
  rounds: number
  reps: Reps
  note: string
}

export interface AbsBlock {
  weeks: [number, number]
  items: AbsItem[]
}

export interface AbsProgramFile {
  id: string
  name: string
  type: 'structured-circuit'
  weeksCount: number
  placement: string
  format: string
  restBetweenRoundsSec: number
  progressionRule: string
  blocks: AbsBlock[]
}

export interface TemplateSlot {
  slot: string
  label: string
  sets: number
  repRange: [number, number]
  restSec: number
  defaultExerciseId: string
  note: string
  superset?: string
}

export interface UpperVariant extends Variant {
  /** Nombre de tours du circuit abdos enchaîné après cette séance (remplace celui du programme abdos). */
  abdosRounds: number
  slots: TemplateSlot[]
}

export interface UpperTemplate {
  id: 'push' | 'pull'
  name: string
  variants: UpperVariant[]
  thenProgram?: string
}

export interface UpperBodyFile {
  id: string
  name: string
  type: 'template-slots'
  version?: number
  changelog?: string[]
  progressionRule: { type: 'double-progression'; text: string }
  variantRule?: string
  supersetRule?: string
  abdosRule?: string
  templates: UpperTemplate[]
}

export interface PlanningFile {
  weekPlan: Record<string, string>
  startDate: string | null
  note?: string
}
