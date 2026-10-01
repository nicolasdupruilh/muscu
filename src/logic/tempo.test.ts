import { describe, expect, it } from 'vitest'
import { describeTempo } from './tempo'

describe('tempo en clair', () => {
  it('traduit les tempos du programme', () => {
    expect(describeTempo('3-0-X-0')).toBe('Descente 3 s, remontée explosive')
    expect(describeTempo('2-1-1-0')).toBe('Descente 2 s, pause 1 s en bas, remontée 1 s')
    expect(describeTempo('2-1-1-1')).toBe('Descente 2 s, pause 1 s en bas, remontée 1 s, pause 1 s en haut')
  })
  it('laisse tel quel un tempo illisible', () => {
    expect(describeTempo('lent')).toBe('lent')
  })
})
