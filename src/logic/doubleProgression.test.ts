import { describe, expect, it } from 'vitest'
import { doubleProgression } from './doubleProgression'

describe('double progression', () => {
  it('sans historique : bas de la fourchette, charge à choisir', () => {
    const t = doubleProgression({ last: [], repRange: [6, 10], sets: 3, incrementKg: 2 })
    expect(t.sets).toEqual([{ value: 6 }, { value: 6 }, { value: 6 }])
    expect(t.increased).toBe(false)
    expect(t.reason).toContain('choisis ta charge')
  })

  it('toutes les séries au haut de la fourchette : + incrément et retour au bas', () => {
    const last = [
      { loadKg: 30, value: 10 },
      { loadKg: 30, value: 10 },
      { loadKg: 30, value: 11 },
    ]
    const t = doubleProgression({ last, repRange: [6, 10], sets: 3, incrementKg: 2 })
    expect(t.sets).toEqual([
      { loadKg: 32, value: 6 },
      { loadKg: 32, value: 6 },
      { loadKg: 32, value: 6 },
    ])
    expect(t.increased).toBe(true)
    expect(t.reason).toBe('Toutes les séries à 10 reps la dernière fois : +2 kg, repars à 6 reps.')
  })

  it('sinon : même charge, +1 rep sur les séries sous le haut', () => {
    const last = [
      { loadKg: 30, value: 10 },
      { loadKg: 30, value: 8 },
      { loadKg: 30, value: 7 },
    ]
    const t = doubleProgression({ last, repRange: [6, 10], sets: 3, incrementKg: 2 })
    expect(t.sets).toEqual([
      { loadKg: 30, value: 10 },
      { loadKg: 30, value: 9 },
      { loadKg: 30, value: 8 },
    ])
    expect(t.increased).toBe(false)
    expect(t.reason).toBe('Même charge, +1 rep sur les séries sous 10 reps.')
  })

  it("n'augmente pas si des séries manquaient la dernière fois", () => {
    const last = [
      { loadKg: 30, value: 10 },
      { loadKg: 30, value: 10 },
    ]
    const t = doubleProgression({ last, repRange: [6, 10], sets: 3, incrementKg: 2 })
    expect(t.increased).toBe(false)
    expect(t.sets.map((s) => s.value)).toEqual([10, 10, 10])
  })

  it('suit la charge de chaque série si elles différaient', () => {
    const last = [
      { loadKg: 32, value: 10 },
      { loadKg: 30, value: 10 },
      { loadKg: 30, value: 10 },
    ]
    const t = doubleProgression({ last, repRange: [6, 10], sets: 3, incrementKg: 2 })
    expect(t.sets.map((s) => s.loadKg)).toEqual([34, 32, 32])
  })

  it('poids du corps + lest : le lest part de 0', () => {
    const last = [
      { loadKg: 0, value: 8 },
      { loadKg: 0, value: 8 },
      { loadKg: 0, value: 8 },
      { loadKg: 0, value: 8 },
    ]
    const t = doubleProgression({ last, repRange: [5, 8], sets: 4, incrementKg: 2 })
    expect(t.sets.every((s) => s.loadKg === 2 && s.value === 5)).toBe(true)
  })

  it('sans charge : plafonne au haut de la fourchette et propose une variante', () => {
    const last = [
      { value: 10 },
      { value: 10 },
    ]
    const t = doubleProgression({ last, repRange: [5, 10], sets: 2, unit: 's' })
    expect(t.sets).toEqual([{ value: 10 }, { value: 10 }])
    expect(t.reason).toContain('variante plus dure')
  })

  it('en durée : +1 s sur les tenues sous le haut', () => {
    const t = doubleProgression({ last: [{ value: 6 }, { value: 5 }], repRange: [5, 10], sets: 2, unit: 's' })
    expect(t.sets).toEqual([{ value: 7 }, { value: 6 }])
    expect(t.reason).toBe('+1 s sur les séries sous 10 s.')
  })
})
