import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "favicon-fallback",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/favicon.ico") {
            req.url = "/favicon.svg";
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/favicon.ico") {
            req.url = "/favicon.svg";
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5176,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
