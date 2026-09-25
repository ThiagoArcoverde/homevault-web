import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'homevault.home.arpa',
      'homevault.home.com',
      'homevault.home',
    ],
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
  },
})
