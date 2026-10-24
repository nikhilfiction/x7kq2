import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development, requests to /api (and the FastAPI docs) are forwarded to the
// backend on port 8000, so the frontend can call relative URLs like /api/series.
const backend = 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/docs': backend,
      '/openapi.json': backend,
    },
  },
})
