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

const issuer = requiredUrl("VITE_OIDC_ISSUER", import.meta.env.VITE_OIDC_ISSUER);
// A descoberta não publica a API nem as páginas de conta: caminhos fixos sobre a origem do issuer,
// montados só aqui (exceção a I5, ADR 0020), sem variável própria (ADR 0005).
const idpOrigin = new URL(issuer).origin;

export const config = {
  oidc: {
    issuer,
    clientId: required("VITE_OIDC_CLIENT_ID", import.meta.env.VITE_OIDC_CLIENT_ID),
    redirectUri: requiredUrl("VITE_OIDC_REDIRECT_URI", import.meta.env.VITE_OIDC_REDIRECT_URI),
    postLogoutRedirectUri: requiredUrl(
      "VITE_OIDC_POST_LOGOUT_REDIRECT_URI",
      import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
    ),
    scope: "openid profile email conta", // docs/contrato-idp.md §3; não varia por ambiente
  },
  idp: {
    api: {
      conta: `${idpOrigin}/api/conta/`,
      confirmacao: `${idpOrigin}/api/conta/confirmacao/`,
      termos: `${idpOrigin}/api/conta/termos/`,
    },
    paginas: {
      recuperarSenha: `${idpOrigin}/accounts/password_reset/`,
      trocarSenha: `${idpOrigin}/accounts/password_change/`,
      trocarEmail: `${idpOrigin}/accounts/email/`,
      excluir: `${idpOrigin}/accounts/excluir/`,
    },
  },
} as const;

export type AppConfig = typeof config;
