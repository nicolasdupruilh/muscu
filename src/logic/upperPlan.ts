/**
 * Repère d'une place de l'ancienne trame : « push:triceps:2 » = 2e place triceps du push.
 * Les séances push et pull sont libres depuis la v5, mais les séries enregistrées avant gardent ce repère.
 */
export const placeKey = (templateId: string, slot: string, occurrence: number) => `${templateId}:${slot}:${occurrence}`

/** Identifiant lisible et unique à partir d'un nom : « Curl araignée » → « curl-araignee ». */
export function slugify(name: string, taken: (id: string) => boolean): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'exercice'
  let id = base
  for (let n = 2; taken(id); n++) id = `${base}-${n}`
  return id
}
