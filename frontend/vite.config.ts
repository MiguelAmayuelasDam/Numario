import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Proxy para futuras llamadas a la API bajo /api (Fase 2+).
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: "./src/setupTests.ts",
    css: true,
    // Los tests E2E de Playwright viven en e2e/ y se corren con `npm run test:e2e`.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
})
