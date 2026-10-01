// Dates en heure locale. Une date seule s'écrit AAAA-MM-JJ.

const pad = (n: number) => String(n).padStart(2, '0')

export function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Lundi 0 h de la semaine de d, en heure locale. */
export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7))
  return r
}

export function isSameWeek(a: Date, b: Date): boolean {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime()
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const shortFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export const formatDay = (d: Date) => dayFormat.format(d)

/** « 1 octobre 2026 » à partir de « 2026-10-01 ». */
export function formatLocalDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return shortFormat.format(new Date(y, m - 1, d))
}
