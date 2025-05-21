import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    proxy: {
      "/api/v1/chat/completions": {
        target: "https://wings-tigerai-hub.test.tigerbrokers.net/",
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
