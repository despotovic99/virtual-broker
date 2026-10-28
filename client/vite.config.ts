import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Klijent radi lokalno, a API u Docker-u na localhost:3000.
      // xfwd prosleđuje IP adresu browsera API-ju.
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000', xfwd: true },
    },
  },
})
