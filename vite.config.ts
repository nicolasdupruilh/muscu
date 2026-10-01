import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Chemins relatifs : l'appli marche aussi bien à la racine que dans un sous-dossier (GitHub Pages).
  base: './',
  plugins: [
    react(),
    // Configuration minimale ; le mode hors ligne et les icônes seront finalisés à l'étape 6.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Muscu',
        short_name: 'Muscu',
        lang: 'fr',
        display: 'standalone',
        start_url: '.',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
