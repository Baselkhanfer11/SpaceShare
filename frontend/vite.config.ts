import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
