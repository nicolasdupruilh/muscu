import { describe, expect, it } from 'vitest'
import { doubleProgression } from './doubleProgression'
import { parseLoad, roundLoad } from './load'

describe('saisie de charge', () => {
  it('accepte la virgule, le point et « kg »', () => {
    expect(parseLoad('74')).toEqual({ kg: 74, rounded: false })
    expect(parseLoad('74,5')).toEqual({ kg: 74.5, rounded: false })
    expect(parseLoad('74.5')).toEqual({ kg: 74.5, rounded: false })
    expect(parseLoad(' 15 kg ')).toEqual({ kg: 15, rounded: false })
    expect(parseLoad('0')).toEqual({ kg: 0, rounded: false })
  })

  it('arrondit au 0,5 kg le plus proche', () => {
    expect(parseLoad('74,3')).toEqual({ kg: 74.5, rounded: true })
    expect(parseLoad('74,2')).toEqual({ kg: 74, rounded: true })
    expect(parseLoad('16,75')).toEqual({ kg: 17, rounded: true })
    expect(roundLoad(32.4)).toBe(32.5)
  })

  it('refuse ce qui n’est pas une charge', () => {
    for (const bad of ['', 'abc', '-5', '74,5,1', '1000']) expect(parseLoad(bad)).toBeUndefined()
  })
})

describe('progression à partir d’une charge hors cran', () => {
  it('ajoute l’incrément à la charge réellement faite, sans l’arrondir au cran', () => {
    const last = [15, 15, 15].map((loadKg) => ({ loadKg, value: 12 }))
    expect(doubleProgression({ last, repRange: [8, 12], sets: 3, incrementKg: 2 }).sets[0]).toEqual({ loadKg: 17, value: 8 })
    const last2 = [74, 74, 74, 74].map((loadKg) => ({ loadKg, value: 7 }))
    expect(doubleProgression({ last: last2, repRange: [6, 10], sets: 4, incrementKg: 2.5 }).sets[0]).toEqual({ loadKg: 74, value: 8 })
  })
})
