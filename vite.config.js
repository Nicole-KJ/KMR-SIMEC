import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5176,
    strictPort: true,
    headers: {
      // Permite que IndexedDB y APIs seguras funcionen desde IPs de red (HTTP)
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  plugins: [react()],
})

