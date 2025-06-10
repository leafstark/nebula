import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'nebula.svg'],
      manifest: {
        name: 'Nebula',
        short_name: 'Nebula',
        description: 'Frontend platform with OpenAI API compatibility.',
        theme_color: '#FCFCFC',
        background_color: '#FCFCFC',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'nebula.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      "/api": {
        target: "https://wings-nebula.test.tigerbrokers.net/",
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
