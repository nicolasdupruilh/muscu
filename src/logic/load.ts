// Charges : toute charge multiple de 0,5 kg est permise, indépendamment du cran de l'exercice.

export const LOAD_STEP_MIN = 0.5
const MAX_LOAD = 500

/** Arrondit au 0,5 kg le plus proche. */
export const roundLoad = (kg: number) => Math.round(kg / LOAD_STEP_MIN) * LOAD_STEP_MIN

export interface ParsedLoad {
  kg: number
  /** La saisie n'était pas un multiple de 0,5 et a été arrondie. */
  rounded: boolean
}

/** Lit une charge tapée au clavier : « 74 », « 74,5 », « 74.5 », « 74,3 kg » (arrondi à 74,5). */
export function parseLoad(text: string): ParsedLoad | undefined {
  const cleaned = text.trim().replace(/\s*kg$/i, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return undefined
  const raw = Number(cleaned)
  if (!Number.isFinite(raw) || raw > MAX_LOAD) return undefined
  const kg = roundLoad(raw)
  return { kg, rounded: Math.abs(kg - raw) > 1e-9 }
}
