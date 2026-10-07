// Vérifie la cohérence des fichiers de data/ : formes attendues et références entre fichiers.
// Une erreur dans un JSON doit se voir tout de suite, pas en pleine séance.

const LOAD_UNITS = ['kg', 'bodyweight', 'bodyweight+kg', 'time', 'none']

export interface RawData {
  exercises: unknown
  legs: unknown
  abs: unknown
  upperBody: unknown
}

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isReps = (v: unknown) => isNum(v) || (isStr(v) && v.trim() !== '')

export function validateData(raw: RawData): string[] {
  const errors: string[] = []
  const err = (msg: string) => errors.push(msg)

  // Catalogue
  const ids = new Set<string>()
  const slots = new Set<string>()
  const exs = isObj(raw.exercises) ? raw.exercises.exercises : undefined
  if (!Array.isArray(exs)) {
    err('exercises.json : liste « exercises » absente')
  } else {
    exs.forEach((e, i) => {
      const where = `exercises.json, exercice n°${i + 1}`
      if (!isObj(e)) return err(`${where} : pas un objet`)
      if (!isStr(e.id) || !e.id) return err(`${where} : id manquant`)
      if (ids.has(e.id)) err(`${where} : id « ${e.id} » en double`)
      ids.add(e.id)
      if (!isStr(e.name)) err(`${where} (${e.id}) : nom manquant`)
      if (!LOAD_UNITS.includes(e.loadUnit as string)) err(`${where} (${e.id}) : loadUnit « ${String(e.loadUnit)} » inconnue`)
      if (!isNum(e.defaultRestSec)) err(`${where} (${e.id}) : defaultRestSec manquant`)
      if (!Array.isArray(e.slots)) err(`${where} (${e.id}) : slots doit être une liste`)
      else e.slots.forEach((s) => isStr(s) && slots.add(s))
      if ((e.loadUnit === 'kg' || e.loadUnit === 'bodyweight+kg') && !isNum(e.loadIncrementKg)) {
        err(`${where} (${e.id}) : loadIncrementKg manquant pour une charge en kg`)
      }
    })
  }
  const checkRef = (id: unknown, where: string) => {
    if (!isStr(id) || !ids.has(id)) err(`${where} : exercice « ${String(id)} » absent du catalogue`)
  }

  // Programme jambes
  const legs = raw.legs
  if (!isObj(legs) || !Array.isArray(legs.weeks) || !isNum(legs.weeksCount) || !Array.isArray(legs.sessionsPerWeek)) {
    err('programme-jambes.json : structure inattendue (weeks, weeksCount, sessionsPerWeek)')
  } else {
    const names = legs.sessionsPerWeek as unknown[]
    if (legs.weeks.length !== legs.weeksCount) err(`programme-jambes.json : ${legs.weeks.length} semaines au lieu de ${legs.weeksCount}`)
    legs.weeks.forEach((w, i) => {
      if (!isObj(w)) return err(`programme-jambes.json, semaine n°${i + 1} : pas un objet`)
      if (w.week !== i + 1) err(`programme-jambes.json : semaine n°${i + 1} numérotée ${String(w.week)}`)
      if (!isObj(w.sessions)) return err(`programme-jambes.json, semaine ${i + 1} : séances absentes`)
      for (const name of names) {
        const s = (w.sessions as Obj)[name as string]
        const where = `programme-jambes.json, semaine ${i + 1} séance ${String(name)}`
        if (!isObj(s) || !Array.isArray(s.items)) {
          err(`${where} : absente`)
          continue
        }
        s.items.forEach((it, j) => {
          const w2 = `${where}, ligne ${j + 1}`
          if (!isObj(it)) return err(`${w2} : pas un objet`)
          checkRef(it.exerciseId, w2)
          if (it.exerciseId === 'leg-extension') err(`${w2} : leg extension interdit`)
          if (!isNum(it.sets)) err(`${w2} : sets manquant`)
          if (!isReps(it.reps)) err(`${w2} : reps manquant`)
          if (!isNum(it.restSec)) err(`${w2} : restSec manquant`)
        })
      }
    })
    const hc = legs.healthCheck
    if (!isObj(hc) || !Array.isArray(hc.rules) || hc.rules.length === 0) err('programme-jambes.json : healthCheck.rules absent')
    if (legs.version !== undefined && !(Number.isInteger(legs.version) && (legs.version as number) >= 1)) err('programme-jambes.json : version doit être un entier à partir de 1')
    if (legs.changelog !== undefined && !(Array.isArray(legs.changelog) && legs.changelog.every(isStr))) err('programme-jambes.json : changelog doit être une liste de textes')
  }

  // Programme abdos
  const abs = raw.abs
  if (!isObj(abs) || !Array.isArray(abs.blocks) || !isNum(abs.weeksCount)) {
    err('programme-abdos.json : structure inattendue (blocks, weeksCount)')
  } else {
    const covered = new Array<number>(abs.weeksCount).fill(0)
    abs.blocks.forEach((b, i) => {
      const where = `programme-abdos.json, bloc n°${i + 1}`
      if (!isObj(b) || !Array.isArray(b.weeks) || !Array.isArray(b.items)) return err(`${where} : structure inattendue`)
      const [from, to] = b.weeks as number[]
      for (let w = from; w <= to; w++) if (w >= 1 && w <= covered.length) covered[w - 1]++
      b.items.forEach((it, j) => {
        if (!isObj(it)) return err(`${where}, ligne ${j + 1} : pas un objet`)
        checkRef(it.exerciseId, `${where}, ligne ${j + 1}`)
        if (!isNum(it.rounds)) err(`${where}, ligne ${j + 1} : rounds manquant`)
        if (!isReps(it.reps)) err(`${where}, ligne ${j + 1} : reps manquant`)
      })
    })
    covered.forEach((n, w) => {
      if (n !== 1) err(`programme-abdos.json : la semaine ${w + 1} est couverte par ${n} bloc(s)`)
    })
  }

  // Trames haut du corps
  const ub = raw.upperBody
  if (!isObj(ub) || !Array.isArray(ub.templates)) {
    err('programme-haut-du-corps.json : liste « templates » absente')
  } else {
    for (const id of ['push', 'pull']) {
      const t = ub.templates.find((t) => isObj(t) && t.id === id)
      if (!isObj(t) || !Array.isArray(t.slots)) {
        err(`programme-haut-du-corps.json : trame « ${id} » absente`)
        continue
      }
      t.slots.forEach((s, j) => {
        const where = `programme-haut-du-corps.json, ${id} slot n°${j + 1}`
        if (!isObj(s)) return err(`${where} : pas un objet`)
        checkRef(s.defaultExerciseId, where)
        const range = s.repRange
        if (!Array.isArray(range) || range.length !== 2 || !isNum(range[0]) || !isNum(range[1]) || range[0] > range[1]) {
          err(`${where} : repRange invalide`)
        }
        if (!isStr(s.slot) || !slots.has(s.slot)) err(`${where} : aucun exercice du catalogue pour le slot « ${String(s.slot)} »`)
        else if (isStr(s.defaultExerciseId)) {
          const ex = (exs as Obj[] | undefined)?.find((e) => e.id === s.defaultExerciseId)
          if (ex && Array.isArray(ex.slots) && !ex.slots.includes(s.slot)) {
            err(`${where} : l'exercice par défaut « ${s.defaultExerciseId} » n'appartient pas au slot « ${s.slot} »`)
          }
        }
      })
    }
  }

  return errors
}
