import { HashRouter, NavLink, Route, Routes } from 'react-router'
import { Accueil } from './screens/Accueil'
import { ChoixSeance } from './screens/ChoixSeance'
import { ApercuAbdos, ApercuHaut, ApercuJambes } from './screens/Apercu'
import { Historique } from './screens/Historique'
import { Reglages } from './screens/Reglages'
import { dataErrors } from './data'

const tabs = [
  { to: '/', label: 'Accueil', icon: '⌂', end: true },
  { to: '/seance', label: 'Séance', icon: '▶', end: false },
  { to: '/historique', label: 'Historique', icon: '☰', end: false },
  { to: '/reglages', label: 'Réglages', icon: '⚙', end: false },
]

export function App() {
  return (
    <HashRouter>
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
            <Route path="/seance" element={<ChoixSeance />} />
            <Route path="/seance/jambes/:index" element={<ApercuJambes />} />
            <Route path="/seance/abdos/:index" element={<ApercuAbdos />} />
            <Route path="/seance/:type" element={<ApercuHaut />} />
            <Route path="/historique" element={<Historique />} />
            <Route path="/reglages" element={<Reglages />} />
          </Routes>
        </main>
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
