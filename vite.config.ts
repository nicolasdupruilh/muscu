import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Chemins relatifs : l'appli marche aussi bien à la racine que dans un sous-dossier (GitHub Pages).
  base: './',
  plugins: [
    react(),
    // Appli installable et utilisable hors ligne : tous les fichiers sont mis en cache au premier chargement,
    // et la nouvelle version s'installe toute seule au lancement suivant.
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
      },
      manifest: {
        name: 'Muscu',
        short_name: 'Muscu',
        lang: 'fr',
        display: 'standalone',
        start_url: '.',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        description: "Mes séances de muscu : programme jambes, haut du corps, abdos, chrono de repos.",
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
