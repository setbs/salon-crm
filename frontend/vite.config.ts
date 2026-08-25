import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const target = mode === "salon" || mode === "crm" ? mode : "all";
  const input =
    target === "salon"
      ? resolve(projectRoot, "index.html")
      : target === "crm"
        ? resolve(projectRoot, "crm.html")
        : {
            salon: resolve(projectRoot, "index.html"),
            crm: resolve(projectRoot, "crm.html")
          };

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": "http://localhost:4000",
        "/uploads": "http://localhost:4000"
      }
    },
    build: {
      outDir: target === "salon" ? "dist-salon" : target === "crm" ? "dist-crm" : "dist",
      rollupOptions: {
        input
      }
    }
  };
});
