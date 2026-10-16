import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@Common': fileURLToPath(new URL('./src/common', import.meta.url)),
      '@Components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@Router': fileURLToPath(new URL('./src/router', import.meta.url)),
      '@Setup': fileURLToPath(new URL('./src/setup', import.meta.url)),
      '@Stores': fileURLToPath(new URL('./src/stores', import.meta.url)),
      '@Views': fileURLToPath(new URL('./src/views', import.meta.url)),
    }
  }
})
