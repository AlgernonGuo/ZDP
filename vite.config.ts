import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2021',
    sourcemap: false,
  },
  server: {
    port: 3000,
    proxy: {
      '/DeliveryApply': {
        target: 'http://qaweixin.flsoft.cc',
        changeOrigin: true,
        secure: false,
      },
      '/WXAuth': {
        target: 'http://qaweixin.flsoft.cc',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
