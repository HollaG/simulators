import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Pages supplies its repository prefix; local development stays at the root.
  base: process.env.VITE_BASE_PATH || "/",
});
