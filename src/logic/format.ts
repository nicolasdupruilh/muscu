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
