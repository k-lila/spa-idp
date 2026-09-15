import { generateKeyPairSync } from "node:crypto";
import express from "express";
import Provider from "oidc-provider";

const PORT = 9000;
const ISSUER = `http://localhost:${PORT}/o`; // sufixo /o espelha o IdP real
const SPA_ORIGIN = "http://localhost:5173"; // única fonte p/ redirect_uri e CORS
const USER = { name: "Usuária de Teste", email: "teste@example.com" };

// Chave RS256 nova a cada boot (tokens vivem em memória na SPA; nada sobrevive ao restart).
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...privateKey.export({ format: "jwk" }), alg: "RS256", use: "sig" };

const provider = new Provider(ISSUER, {
  jwks: { keys: [jwk] },
  cookies: { keys: ["idp-fake-dev-only"] }, // assina cookie do fake; não é segredo
  clients: [
    {
      client_id: "spa-local",
      redirect_uris: [`${SPA_ORIGIN}/callback`],
      token_endpoint_auth_method: "none", // client público
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
  ],
  pkce: { required: () => true }, // S256 é o único método suportado pelo provider
  claims: { openid: ["sub"], profile: ["name"], email: ["email"] }, // sem email_verified
  conformIdTokenClaims: false, // name/email vão no id_token, como o django-oauth-toolkit faz
  issueRefreshToken: async () => true, // IdP real emite refresh sempre
  // Só vale em requisições que resolvem um client (ex.: POST /token); preflight, discovery e jwks
  // ecoam qualquer origem. Bloqueio efetivo: troca de code de outra origem → 400.
  clientBasedCORS: (_ctx, origin) => origin === SPA_ORIGIN,
  features: {
    devInteractions: { enabled: true }, // login/consent prontos; qualquer senha
    rpInitiatedLogout: { enabled: false }, // IdP real tem logout desligado
  },
  // accountId == login digitado (mesma forma do default do provider, evita checagens cruzadas
  // grant/sessão/token). name/email fixos; sub = login. Sugerido: fake-user-1.
  async findAccount(_ctx, id) {
    return {
      accountId: id,
      async claims() {
        return { sub: id, ...USER };
      },
    };
  },
});

const app = express();
app.use("/o", provider.callback());
app.listen(PORT, () => {
  console.log(`IdP fake em ${ISSUER}/.well-known/openid-configuration`);
  console.log("login sugerido: fake-user-1 (senha: qualquer)");
});
