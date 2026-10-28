import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path' // 이 줄이 있어야 합니다

export default defineConfig({
  logLevel: 'error',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});