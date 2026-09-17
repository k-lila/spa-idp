import { beforeEach, describe, expect, it, vi } from "vitest";

// config.ts é o primeiro módulo que roda no boot (main.tsx importa por efeito colateral) e só
// quebra em runtime se faltar/for inválida uma VITE_*. Ambiente node: não toca DOM.

const ENV_VARS = ["VITE_OIDC_ISSUER", "VITE_OIDC_CLIENT_ID", "VITE_OIDC_REDIRECT_URI"] as const;
type EnvVar = (typeof ENV_VARS)[number];

const URL_VARS: readonly EnvVar[] = ["VITE_OIDC_ISSUER", "VITE_OIDC_REDIRECT_URI"];

const VALID: Record<EnvVar, string> = {
  VITE_OIDC_ISSUER: "https://issuer.example/o",
  VITE_OIDC_CLIENT_ID: "spa-test",
  VITE_OIDC_REDIRECT_URI: "https://app.example/callback",
};

// Estuba as 3 variáveis com valores válidos; nunca depende de .env.local (há um no working
// tree). overrides substitui pontualmente a(s) variável(is) sob teste.
function stubAll(overrides: Partial<Record<EnvVar, string | undefined>> = {}): void {
  for (const name of ENV_VARS) {
    vi.stubEnv(name, name in overrides ? overrides[name] : VALID[name]);
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("config", () => {
  it("(a) as 3 variáveis válidas ecoam em config; scope é o contrato fixo", async () => {
    stubAll();

    const { config } = await import("./config");

    expect(config.oidc.issuer).toBe(VALID.VITE_OIDC_ISSUER);
    expect(config.oidc.clientId).toBe(VALID.VITE_OIDC_CLIENT_ID);
    expect(config.oidc.redirectUri).toBe(VALID.VITE_OIDC_REDIRECT_URI);
    expect(config.oidc.scope).toBe("openid profile email");
  });

  it.each(ENV_VARS)("(b) %s ausente rejeita com Error nomeando a variável", async (name) => {
    stubAll({ [name]: undefined });

    await expect(import("./config")).rejects.toThrow(new RegExp(name));
  });

  it.each(ENV_VARS)("(c) %s só com espaços rejeita com Error nomeando a variável", async (name) => {
    stubAll({ [name]: "   " });

    await expect(import("./config")).rejects.toThrow(new RegExp(name));
  });

  it("(c) string vazia é o mesmo ramo do trim — cobrir uma vez", async () => {
    stubAll({ VITE_OIDC_ISSUER: "" });

    await expect(import("./config")).rejects.toThrow(new RegExp("VITE_OIDC_ISSUER"));
  });

  it.each(URL_VARS)(
    "(d) %s com valor que não é URL rejeita nomeando a variável e 'URL'",
    async (name) => {
      stubAll({ [name]: "nao-e-url" });

      await expect(import("./config")).rejects.toThrow(new RegExp(`${name}.*URL`));
    },
  );

  it("(e) VITE_OIDC_CLIENT_ID aceita valor que não é URL (required, não requiredUrl)", async () => {
    stubAll({ VITE_OIDC_CLIENT_ID: "nao-e-url" });

    const { config } = await import("./config");

    expect(config.oidc.clientId).toBe("nao-e-url");
  });
});
