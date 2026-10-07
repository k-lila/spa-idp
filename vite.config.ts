import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { configDefaults } from "vitest/config";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // O IdP real de desenvolvimento só aceita redirect https: com certificado (mkcert, fora do
  // repositório), a SPA de dev serve https. Sem o prefixo VITE_, estas variáveis não vão ao bundle.
  const { SPA_DEV_TLS_CERT: cert, SPA_DEV_TLS_KEY: key } = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Porta fixa: o IdP fake rejeita redirect_uri/CORS em outra porta
      port: 5173,
      strictPort: true,
      https: cert && key ? { cert: readFileSync(cert), key: readFileSync(key) } : undefined,
    },
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
  };
});
