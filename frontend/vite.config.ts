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
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/components/ui/**", // primitivas shadcn (código vendido)
        "src/**/*.test.{ts,tsx}",
        "src/setupTests.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/**/*.d.ts",
      ],
      // Gate de calidad (Fase 6). Requisito del hito: ≥70% en lógica de negocio.
      thresholds: { statements: 75, branches: 70, functions: 65, lines: 75 },
    },
  },
})
