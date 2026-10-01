import { useEffect } from 'react'

/** Garde l'écran allumé tant que `enabled` est vrai (API Wake Lock, si le navigateur la propose). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | undefined
    let cancelled = false
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || lock) return
      try {
        lock = await navigator.wakeLock.request('screen')
        lock.addEventListener('release', () => (lock = undefined))
        if (cancelled) void lock.release()
      } catch {
        // Refusé (batterie faible…) : l'écran s'éteindra normalement.
      }
    }
    // Le verrou saute quand l'appli passe en arrière-plan : on le reprend au retour.
    const onVisible = () => void acquire()
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [enabled])
}
