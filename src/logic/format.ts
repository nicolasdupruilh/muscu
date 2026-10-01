import type { LoadUnit } from '../data/types'

/** 90 → « 1 min 30 », 45 → « 45 s », 120 → « 2 min ». */
export function formatRest(sec: number): string {
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`
}

/** Reps prescrites : 6 → « 6 reps », « 20 s » reste tel quel. */
export const formatReps = (reps: number | string) => (typeof reps === 'number' ? `${reps} rep${reps > 1 ? 's' : ''}` : reps)

/** 72.5 → « 72,5 kg ». */
export const formatKg = (kg: number) => `${kg.toLocaleString('fr-FR')} kg`


/** Charge d'une série selon l'unité : « 30 kg », « PDC + 2 kg », « PDC » ; vide sans charge ou charge inconnue. */
export function formatLoad(kg: number | undefined, unit: LoadUnit): string {
  if (unit === 'kg') return kg === undefined ? '' : formatKg(kg)
  if (unit === 'bodyweight+kg') return kg ? `PDC + ${formatKg(kg)}` : 'PDC'
  return ''
}

/** Valeur réalisée : « 10 » reps, ou « 8 s » pour un exercice en durée. */
export const formatValue = (value: number, unit: LoadUnit) => (unit === 'time' ? `${value} s` : `${value}`)

/** Une série complète : « 30 kg × 10 », « PDC × 8 », « 10 reps », « 8 s ». */
export function formatSet(loadKg: number | undefined, value: number, unit: LoadUnit): string {
  const load = formatLoad(loadKg, unit)
  if (unit === 'time') return load ? `${load} · ${value} s` : `${value} s`
  return load ? `${load} × ${value}` : `${value} rep${value > 1 ? 's' : ''}`
}
