import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In development the API is proxied, so the browser talks to a single origin (no CORS setup).
// Override with API_URL=http://127.0.0.1:8080 to use the Dockerised stack instead of a local uvicorn.
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: API_URL }, '/docs': { target: API_URL }, '/openapi.json': { target: API_URL } },
  },
  build: {
    // Never inline assets as data: URIs. Small font subsets would otherwise be inlined and then
    // blocked by the production Content-Security-Policy (font-src 'self'; see docker/nginx.conf).
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Keep heavy, rarely-needed libraries out of the entry chunk
        manualChunks(id: string) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-vendor')) return 'charts'
          if (id.includes('node_modules/@dicebear')) return 'avatars'
        },
      },
    },
  },
})
