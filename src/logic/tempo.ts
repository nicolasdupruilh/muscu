// Tempo « excentrique-pause bas-concentrique-pause haut », en secondes, X = explosif.

export function describeTempo(tempo: string): string {
  const parts = tempo.split('-').map((p) => p.trim().toUpperCase())
  if (parts.length !== 4) return tempo
  const [down, bottom, up, top] = parts
  const sec = (p: string) => `${p} s`
  const out: string[] = []
  if (down !== '0') out.push(down === 'X' ? 'descente rapide' : `descente ${sec(down)}`)
  if (bottom !== '0') out.push(`pause ${sec(bottom)} en bas`)
  if (up === 'X') out.push('remontée explosive')
  else if (up !== '0') out.push(`remontée ${sec(up)}`)
  if (top !== '0') out.push(`pause ${sec(top)} en haut`)
  const text = out.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
