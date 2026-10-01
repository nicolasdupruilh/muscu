import { HashRouter, NavLink, Route, Routes } from 'react-router'
import { Accueil } from './screens/Accueil'
import { Seance } from './screens/SeanceEnCours'
import { ApercuAbdos, ApercuJambes } from './screens/Apercu'
import { Historique } from './screens/Historique'
import { Reglages } from './screens/Reglages'
import { dataErrors } from './data'
import { ScrollToTop } from './components/ScrollToTop'
import { RestTimer } from './components/RestTimer'
import { useActiveSession } from './hooks'
import { useWakeLock } from './wakeLock'

const tabs = [
  { to: '/', label: 'Accueil', icon: '⌂', end: true },
  { to: '/seance', label: 'Séance', icon: '▶', end: false },
  { to: '/historique', label: 'Historique', icon: '☰', end: false },
  { to: '/reglages', label: 'Réglages', icon: '⚙', end: false },
]

/** Pendant une séance : écran gardé allumé et chrono de repos visible sur tous les écrans. */
function SessionChrome() {
  const session = useActiveSession()
  useWakeLock(!!session)
  return session ? <RestTimer session={session} /> : null
}

export function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <div className="app">
        <main>
          {dataErrors.length > 0 && (
            <div className="card error">
              <h2>Erreurs dans les fichiers data/</h2>
              <ul>
                {dataErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <Routes>
            <Route path="/" element={<Accueil />} />
            <Route path="/seance" element={<Seance />} />
            <Route path="/seance/jambes/:index" element={<ApercuJambes />} />
            <Route path="/seance/abdos/:index" element={<ApercuAbdos />} />
            <Route path="/historique" element={<Historique />} />
            <Route path="/reglages" element={<Reglages />} />
          </Routes>
        </main>
        <SessionChrome />
        <nav className="tabbar">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="icon" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </HashRouter>
  )
}
