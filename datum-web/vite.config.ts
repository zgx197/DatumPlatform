import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:7000',
      '/hubs': {
        target: 'http://localhost:7000',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../DatumServer/wwwroot',
    emptyOutDir: true,
  },
})
