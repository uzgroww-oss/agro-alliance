import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: { strict: false },
    watch: { usePolling: true, interval: 400 },
    // Ilgari bu yerda "/api" -> localhost:3001 proxy'si bor edi. U eski
    // Node API serveriga qaragan va u server allaqachon yo'q — barcha
    // so'rovlar 502 qaytarardi. Endi hamma narsa Supabase Edge
    // funksiyalariga to'g'ridan-to'g'ri boradi.
  },
})
