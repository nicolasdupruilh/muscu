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
}

export interface LegSession {
  name: string
  items: LegItem[]
}

export interface LegWeek {
  week: number
  block: number
  blockName: string
  deload: boolean
  sessions: Record<string, LegSession>
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
  type: 'structured'
  weeksCount: number
  sessionsPerWeek: string[]
  tempoNotation: string
  loadRule: string
  healthCheck: {
    id: string
    label: string
    questions: HealthQuestion[]
    rules: HealthRule[]
    note: string
  }
  volleyAdjustments: string
  weeks: LegWeek[]
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
}

export interface UpperTemplate {
  id: 'push' | 'pull'
  name: string
  slots: TemplateSlot[]
  thenProgram?: string
}

export interface UpperBodyFile {
  id: string
  name: string
  type: 'template-slots'
  progressionRule: { type: 'double-progression'; text: string }
  templates: UpperTemplate[]
}

export interface PlanningFile {
  weekPlan: Record<string, string>
  startDate: string | null
  note?: string
}
