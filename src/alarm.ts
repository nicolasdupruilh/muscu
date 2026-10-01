// Signal de fin de repos : son, vibration, notification. Tout est « si possible » :
// - le son passe par Web Audio, que Safari n'autorise qu'après un geste (on le débloque à la validation d'une série) ;
// - la vibration n'existe pas sur iPhone (navigator.vibrate absent), elle marche sur Android ;
// - la notification demande l'autorisation, et sur iPhone l'appli installée sur l'écran d'accueil.

let audio: AudioContext | undefined

/** À appeler pendant un geste (clic) : prépare le son pour la fin du repos. */
export function unlockAudio() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    // Pas de Web Audio : tant pis pour le son.
  }
}

function beep() {
  if (!audio) return
  const t0 = audio.currentTime
  for (let i = 0; i < 3; i++) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = i === 2 ? 1320 : 880
    const start = t0 + i * 0.3
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.6, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)
    osc.connect(gain).connect(audio.destination)
    osc.start(start)
    osc.stop(start + 0.25)
  }
}

export const notificationsSupported = () => typeof Notification !== 'undefined'

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.requestPermission()
}

async function notify(body: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification('Repos terminé', { body, tag: 'repos', icon: undefined })
    else new Notification('Repos terminé', { body, tag: 'repos' })
  } catch {
    // Notification refusée par le navigateur : le son et l'écran suffisent.
  }
}

/** Fin du repos : son, vibration, et notification si l'appli n'est pas au premier plan. */
export function restEndAlarm(body: string) {
  beep()
  navigator.vibrate?.([300, 150, 300])
  if (document.visibilityState === 'hidden') void notify(body)
}
