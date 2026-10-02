import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 5173,
    allowedHosts: true,
    // Same-origin API: a phone on the HTTPS tunnel URL reaches the backend through this proxy.
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
