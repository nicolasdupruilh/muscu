import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { syncCatalogue } from './db/db'
import './styles.css'

async function start() {
  try {
    await syncCatalogue()
  } catch (e) {
    console.error('Synchronisation du catalogue impossible', e)
  }
  // Demande à Safari de ne pas effacer les données de l'appli quand l'espace manque.
  navigator.storage?.persist?.().catch(() => {})

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

start()
