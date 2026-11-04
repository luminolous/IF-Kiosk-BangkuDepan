import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Static hosts such as GitHub Pages have no SPA fallback, so the phone page
// needs a real file at mobile/index.html. 404.html covers any other path.
const spaEntries = () => ({
  name: 'spa-entries',
  apply: 'build',
  writeBundle({ dir }) {
    mkdirSync(join(dir, 'mobile'), { recursive: true })
    copyFileSync(join(dir, 'index.html'), join(dir, 'mobile/index.html'))
    copyFileSync(join(dir, 'index.html'), join(dir, '404.html'))
  },
})

// https://vite.dev/config/
export default defineConfig({
  // "/" for local use; the GitHub Pages workflow sets BASE_PATH=/IF-Kiosk/.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss(), spaEntries()],
  server: {
    host: true,   // listen on 0.0.0.0 so phones on same LAN can reach it
    proxy: {
      "/ws": {
        target: "http://localhost:8000",
        ws: true,
      },
    },
  },
  appType: "spa",
})
