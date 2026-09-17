function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`[config] variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function requiredUrl(name: string, value: string | undefined): string {
  const raw = required(name, value);
  try {
    new URL(raw);
  } catch {
    throw new Error(`[config] ${name} não é uma URL válida: ${raw}`);
  }
  return raw;
}

export const config = {
  oidc: {
    issuer: requiredUrl("VITE_OIDC_ISSUER", import.meta.env.VITE_OIDC_ISSUER),
    clientId: required("VITE_OIDC_CLIENT_ID", import.meta.env.VITE_OIDC_CLIENT_ID),
    redirectUri: requiredUrl("VITE_OIDC_REDIRECT_URI", import.meta.env.VITE_OIDC_REDIRECT_URI),
    scope: "openid profile email", // contrato (plano §3), não varia por ambiente
  },
} as const;

export type AppConfig = typeof config;
