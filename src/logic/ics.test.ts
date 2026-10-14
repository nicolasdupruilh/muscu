import { describe, expect, it } from 'vitest'
import { dailyReminderIcs } from './ics'

describe('rappel quotidien', () => {
  it('produit un événement répété chaque jour à 18 h avec une alerte', () => {
    const ics = dailyReminderIcs(
      {
        title: 'Isométriques genou',
        description: '5 × 45 s, 2 min de repos; même les jours sans salle',
        start: new Date(2026, 9, 14, 9),
        hour: 18,
        durationMin: 15,
        days: 14,
        url: 'https://exemple.github.io/muscu/',
      },
      new Date(Date.UTC(2026, 9, 14, 7, 0, 0)),
    )
    const lines = ics.split('\r\n')
    expect(lines).toContain('DTSTART:20261014T180000')
    expect(lines).toContain('DTEND:20261014T181500')
    expect(lines).toContain('RRULE:FREQ=DAILY;COUNT=14')
    expect(lines).toContain('TRIGGER:PT0M')
    expect(lines).toContain('DESCRIPTION:5 × 45 s\\, 2 min de repos\\; même les jours sans salle')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})
