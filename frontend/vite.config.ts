import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The landing page's 3D scene (three.js, ~540 kB) is its own chunk, loaded only on that page.
    chunkSizeWarningLimit: 600,
  },
  server: {
    // Forward any request starting with /api to the .NET backend,
    // so the React code can call "/api/..." with no CORS setup.
    proxy: {
      '/api': {
        target: 'http://localhost:5030',
        changeOrigin: true,
      },
    },
  },
})
