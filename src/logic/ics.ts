// Rappel quotidien par le Calendrier de l'iPhone : une appli web ne peut pas programmer de notification sans serveur,
// mais un événement répété avec une alerte, importé dans le calendrier, sonne de façon fiable.

const pad = (n: number) => String(n).padStart(2, '0')
/** Date-heure locale « flottante » (sans fuseau) : 18 h reste 18 h où que soit le téléphone. */
const local = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
/** Échappe le texte d'un champ iCalendar. */
const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

export interface DailyReminder {
  title: string
  description: string
  /** Premier jour du rappel. */
  start: Date
  hour: number
  minute?: number
  durationMin: number
  /** Nombre de jours. */
  days: number
  url?: string
}

export function dailyReminderIcs(r: DailyReminder, now = new Date()): string {
  const start = new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate(), r.hour, r.minute ?? 0)
  const end = new Date(start.getTime() + r.durationMin * 60_000)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Muscu//Rappel//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:muscu-rappel-${utc(now)}@muscu`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${local(start)}`,
    `DTEND:${local(end)}`,
    `RRULE:FREQ=DAILY;COUNT=${r.days}`,
    `SUMMARY:${text(r.title)}`,
    `DESCRIPTION:${text(r.description)}`,
    ...(r.url ? [`URL:${r.url}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${text(r.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
