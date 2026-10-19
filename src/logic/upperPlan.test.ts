import { describe, expect, it } from 'vitest'
import { slugify } from './upperPlan'

describe('identifiant d’exercice', () => {
  it('est lisible et unique', () => {
    expect(slugify('Curl araignée', () => false)).toBe('curl-araignee')
    expect(slugify('Pull-over (poulie)', () => false)).toBe('pull-over-poulie')
    expect(slugify('Dips', (id) => id === 'dips' || id === 'dips-2')).toBe('dips-3')
    expect(slugify('!!!', () => false)).toBe('exercice')
  })
})
