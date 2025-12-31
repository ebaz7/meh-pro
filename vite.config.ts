
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // بسیار مهم برای اندروید: مسیردهی نسبی
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // --- CODE SPLITTING FOR PERFORMANCE ---
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'lucide-react'],
          charts: ['recharts'],
          utils: ['html2canvas', 'jspdf', '@google/genai']
        }
      }
    }
  }
})
