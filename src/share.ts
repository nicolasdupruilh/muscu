/**
 * Donne un fichier à l'utilisateur : menu de partage sur iPhone (« Enregistrer dans Fichiers », « Calendrier »…),
 * sinon téléchargement. Renvoie false si le partage a été annulé.
 */
export async function shareFile(file: File, title: string): Promise<boolean> {
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title })
      return true
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return false
    throw e
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}
