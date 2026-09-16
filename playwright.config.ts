import { defineConfig, devices } from "@playwright/test";

// Valores literais de .env.example (T-09): process.env.VITE_* vence .env* no Vite
// (node_modules/vite/dist/node/chunks/node.js:5730), então a suite é imune a um .env.local
// divergente. Não duplicar em .env.test/.env.e2e — seria um segundo lugar para os mesmos 4.
const SPA_ENV = {
  VITE_OIDC_ISSUER: "http://localhost:9000/o",
  VITE_OIDC_CLIENT_ID: "spa-local",
  VITE_OIDC_REDIRECT_URI: "http://localhost:5173/callback",
  VITE_IDP_ACCOUNT_URL: "http://localhost:9000/accounts",
};

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Suite que precisa de retry não é determinística — teste que oscila tem a causa registrada,
  // não uma configuração de retry escondendo o sintoma.
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      // O fluxo OIDC não tem ramo por navegador; Firefox/WebKit são custo de download e de
      // tempo sem hipótese a refutar no sandbox.
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run idp",
      url: "http://localhost:9000/o/.well-known/openid-configuration",
      reuseExistingServer: !process.env.CI,
    },
    {
      // `vite` dev, não `vite preview`: preview.port não está fixado e redirect_uri do fake é
      // 5173 (TASK-002). Mudar isso seria alteração em vite.config.ts fora do bloco `test`.
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      env: SPA_ENV,
    },
  ],
});
