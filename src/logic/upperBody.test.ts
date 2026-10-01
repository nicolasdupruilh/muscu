import { describe, expect, it } from 'vitest'
import { nextUpperType } from './upperBody'

describe('prochaine séance haut du corps', () => {
  it('propose push au départ', () => {
    expect(nextUpperType([])).toBe('push')
  })
  it('propose celle faite le moins récemment', () => {
    expect(nextUpperType([{ type: 'push', date: '2026-10-01' }])).toBe('pull')
    expect(
      nextUpperType([
        { type: 'push', date: '2026-10-01' },
        { type: 'pull', date: '2026-10-03' },
        { type: 'jambes', date: '2026-10-04' },
      ]),
    ).toBe('push')
    expect(
      nextUpperType([
        { type: 'pull', date: '2026-10-01' },
        { type: 'push', date: '2026-10-03' },
      ]),
    ).toBe('pull')
  })
})
