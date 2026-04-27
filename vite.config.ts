import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const apiTarget = process.env.VITE_API_URL || "http://127.0.0.1:8001"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // @ts-expect-error vitest config merged
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: "./src/__tests__/setup.ts",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("react-dom") || id.includes("react-router-dom") || (id.includes("node_modules/react/") && !id.includes("react-dom"))) return "vendor";
          if (id.includes("maplibre-gl")) return "maplibre";
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/projects": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/rules": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/triggers": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/jobs": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/capabilities": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/scenarios": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/schedules": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/marketplace": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
      "/health": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
