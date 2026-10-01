// Haut du corps : pas de semaine numérotée, on alterne push et pull.

export type UpperType = 'push' | 'pull'

/** Prochaine séance proposée : celle des deux faite le moins récemment (push si aucune). */
export function nextUpperType(sessions: { type: string; date: string }[]): UpperType {
  const last = (t: UpperType) =>
    sessions.filter((s) => s.type === t).reduce<string | undefined>((m, s) => (m === undefined || s.date > m ? s.date : m), undefined)
  const push = last('push')
  const pull = last('pull')
  if (push === undefined) return 'push'
  if (pull === undefined) return 'pull'
  return push <= pull ? 'push' : 'pull'
}
