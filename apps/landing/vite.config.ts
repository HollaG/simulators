import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  server: {
    proxy: {
      "/mackie-profx22v3": "http://127.0.0.1:5301",
      "/cinetreak-mixer-plus": "http://127.0.0.1:5302",
      "/yamaha-stagepas400i": "http://127.0.0.1:5303",
    },
  },
});
