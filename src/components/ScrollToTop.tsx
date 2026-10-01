import { useEffect } from 'react'
import { useLocation } from 'react-router'

/** Revient en haut de page à chaque changement d'écran. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
