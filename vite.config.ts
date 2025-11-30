import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRITICAL: This sets paths to be relative (e.g. "./assets/index.js")
  // instead of absolute ("/assets/index.js").
  // This is required for hosting on Beget in a public_html folder.
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  },
  server: {
    host: true
  }
})