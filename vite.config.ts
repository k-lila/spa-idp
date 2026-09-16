import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Porta fixa: o IdP fake rejeita redirect_uri/CORS em outra porta
  server: { port: 5173, strictPort: true },
  resolve: {
    // Espelhado em tsconfig.app.json (paths)
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // jsdom só onde precisar (T-02): `// @vitest-environment jsdom` no topo do arquivo.
    environment: "node",
    // Sem isso o include default (**/*.{test,spec}.*) engole e2e/*.spec.ts (Playwright).
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
