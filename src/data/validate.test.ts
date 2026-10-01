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
    l.weeks[2].sessions.A.items[1].exerciseId = 'inconnu'
    expect(validateData({ ...real, legs: l })).toEqual([
      'programme-jambes.json, semaine 3 séance A, ligne 2 : exercice « inconnu » absent du catalogue',
    ])
  })

  it('refusent le leg extension', () => {
    const e = clone(exercises)
    e.exercises.push({ ...e.exercises[0], id: 'leg-extension' })
    const l = clone(legs)
    l.weeks[0].sessions.B.items[0].exerciseId = 'leg-extension'
    expect(validateData({ ...real, exercises: e, legs: l })).toContain(
      'programme-jambes.json, semaine 1 séance B, ligne 1 : leg extension interdit',
    )
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
})
