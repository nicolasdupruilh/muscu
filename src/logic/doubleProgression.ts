// Double progression : même charge tant que toutes les séries n'atteignent pas le haut de la fourchette ;
// quand c'est le cas, +1 cran de charge et on repart du bas de la fourchette.
// « value » = reps, ou secondes pour un exercice en durée.

export interface PastSet {
  loadKg?: number
  value: number
}

export interface SetTarget {
  loadKg?: number
  value: number
}

export interface Target {
  sets: SetTarget[]
  /** Explication affichée sous la cible. */
  reason: string
  /** La charge augmente par rapport à la dernière fois. */
  increased: boolean
}

export interface ProgressionInput {
  /** Séries réalisées la dernière fois, dans l'ordre (vide si jamais fait). */
  last: PastSet[]
  repRange: [number, number]
  /** Nombre de séries prévues aujourd'hui. */
  sets: number
  /** Incrément de charge ; absent pour un exercice sans charge (poids du corps, durée). */
  incrementKg?: number
  /** Unité affichée dans les explications : « reps » ou « s ». */
  unit?: string
}

const fmtKg = (kg: number) => `${kg.toLocaleString('fr-FR')} kg`

export function doubleProgression({ last, repRange, sets, incrementKg, unit = 'reps' }: ProgressionInput): Target {
  const [bottom, top] = repRange
  const count = Math.max(sets, 1)

  if (last.length === 0) {
    return {
      sets: Array.from({ length: count }, () => ({ value: bottom })),
      reason:
        incrementKg !== undefined
          ? `Première fois : choisis ta charge et vise ${bottom} ${unit}.`
          : `Première fois : vise ${bottom} ${unit}.`,
      increased: false,
    }
  }

  // Série de référence pour la série i : la même la dernière fois, sinon la dernière réalisée.
  const ref = (i: number) => last[Math.min(i, last.length - 1)]
  const allAtTop = last.length >= count && last.every((s) => s.value >= top)

  if (allAtTop && incrementKg !== undefined) {
    const targets = Array.from({ length: count }, (_, i) => ({ loadKg: (ref(i).loadKg ?? 0) + incrementKg, value: bottom }))
    return {
      sets: targets,
      reason: `Toutes les séries à ${top} ${unit} la dernière fois : +${fmtKg(incrementKg)}, repars à ${bottom} ${unit}.`,
      increased: true,
    }
  }

  if (allAtTop) {
    return {
      sets: Array.from({ length: count }, (_, i) => ({ loadKg: ref(i).loadKg, value: top })),
      reason: `Haut de la fourchette atteint partout : passe à une variante plus dure.`,
      increased: false,
    }
  }

  const targets = Array.from({ length: count }, (_, i) => {
    const r = ref(i)
    return { loadKg: r.loadKg, value: r.value < top ? Math.min(top, r.value + 1) : top }
  })
  return {
    sets: targets,
    reason: `${incrementKg !== undefined ? 'Même charge, +1' : '+1'} ${unit === 'reps' ? 'rep' : unit} sur les séries sous ${top} ${unit}.`,
    increased: false,
  }
}
