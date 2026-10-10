import { describe, expect, it } from 'vitest'
import exercises from '../../data/exercises.json'
import legs from '../../data/programme-jambes.json'
import abs from '../../data/programme-abdos.json'
import upperBody from '../../data/programme-haut-du-corps.json'
import { validateData } from './validate'

const real = { exercises, legs, abs, upperBody }
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

describe('fichiers de data/', () => {
  it('sont cohérents', () => {
    expect(validateData(real)).toEqual([])
  })

  it('détectent un exercice inconnu', () => {
    const l = clone(legs)
    l.weeks[2].sessions.A.variants[1].items[1].exerciseId = 'inconnu'
    expect(validateData({ ...real, legs: l })).toEqual([
      'programme-jambes.json, semaine 3 séance A, variante n°2 (complete), ligne 2 : exercice « inconnu » absent du catalogue',
    ])
  })

  it('refusent le leg extension', () => {
    const e = clone(exercises)
    e.exercises.push({ ...e.exercises[0], id: 'leg-extension' })
    const l = clone(legs)
    l.weeks[0].sessions.B.variants[0].items[0].exerciseId = 'leg-extension'
    e.exercises.find((x) => x.id === 'copenhague')!.alternatives = ['leg-extension']
    const errors = validateData({ ...real, exercises: e, legs: l })
    expect(errors).toContain('programme-jambes.json, semaine 1 séance B, variante n°1 (1h), ligne 1 : leg extension interdit')
    expect(errors).toContain('exercises.json (copenhague), alternatives : leg extension interdit')
  })

  it('détectent un id en double et une semaine abdos non couverte', () => {
    const e = clone(exercises)
    e.exercises.push(clone(e.exercises[0]))
    const a = clone(abs)
    a.blocks[2].weeks = [9, 15]
    const errors = validateData({ ...real, exercises: e, abs: a })
    expect(errors).toContain(`exercises.json, exercice n°${e.exercises.length} : id « echauffement-jambes » en double`)
    expect(errors).toContain('programme-abdos.json : la semaine 16 est couverte par 0 bloc(s)')
  })

  it('contrôlent les variantes : ordre des durées, supersets, tours d’abdos', () => {
    const l = clone(legs)
    const b = l.weeks[0].sessions.B
    ;[b.variants[0], b.variants[1]] = [b.variants[1], b.variants[0]] // 1 h 30 avant 1 h
    const u = clone(upperBody)
    const slots = u.templates[0].variants[0].slots
    slots[0].superset = 'S1' // S1 n'est plus d'un seul tenant
    u.templates[1].variants[1].abdosRounds = 0
    const errors = validateData({ ...real, legs: l, upperBody: u })
    expect(errors).toContain('programme-jambes.json, semaine 1 séance B, variante n°2 (1h) : les variantes doivent aller de la plus courte à la plus longue')
    expect(errors).toContain('programme-haut-du-corps.json, push, variante n°1 (1h) : les exercices du superset « S1 » doivent se suivre')
    expect(errors).toContain('programme-haut-du-corps.json, pull variante n°2 : abdosRounds doit être un entier à partir de 1')
  })

  it('détectent une alternative inconnue', () => {
    const e = clone(exercises)
    e.exercises.find((x) => x.id === 'epaule')!.alternatives = ['inconnu']
    expect(validateData({ ...real, exercises: e })).toEqual(['exercises.json (epaule), alternatives : exercice « inconnu » absent du catalogue'])
  })
})
