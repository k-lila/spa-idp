import { generateKeyPairSync } from "node:crypto";
import express from "express";
import Provider from "oidc-provider";

const PORT = 9000;
const ISSUER = `http://localhost:${PORT}/o`; // sufixo /o espelha o IdP real
const SPA_ORIGIN = "http://localhost:5173"; // única fonte p/ redirect_uri e CORS
const USER = { name: "Usuária de Teste", email: "teste@example.com" };
// Login que emite `name: ""` (usuário sem nome no IdP real): deve entrar normalmente.
const USER_SEM_NAME = { name: "", email: USER.email };
// Logins que emitem claims malformadas (etapa 4): a SPA deve cair no estado de erro do callback.
const BROKEN_USERS = {
  "sem-name": { email: USER.email },
  "sem-email": { name: USER.name },
  "name-numero": { name: 42, email: USER.email },
};

// Chave RS256 nova a cada boot (tokens vivem em memória na SPA; nada sobrevive ao restart).
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...privateKey.export({ format: "jwk" }), alg: "RS256", use: "sig" };

// O real não pede confirmação quando o hint é do usuário da sessão; o oidc-provider sempre pede.
// Com hint da sessão, submete o form sozinho (`logout=yes` encerra a sessão e revoga os grants);
// nos demais casos, mostra a confirmação. `form` já traz o xsrf. Diverge do real: ele também
// pergunta se o hint já foi revogado (ADR 0029, "Hint sem linha"); aqui só o `sub` conta, e o
// caso de duas abas não é reproduzido (ADR 0019).
async function logoutSource(ctx, form) {
  const hintMatchesSession =
    ctx.oidc.entities.IdTokenHint?.payload.sub === ctx.oidc.session.accountId;
  ctx.body = hintMatchesSession
    ? `<!DOCTYPE html><html><body>${form.replace(
        "</form>",
        '<input type="hidden" name="logout" value="yes"/></form>',
      )}<script>document.forms[0].submit()</script></body></html>`
    : `<!DOCTYPE html><html><body>${form}<p>Encerrar a sessão no IdP fake?</p>` +
      '<button type="submit" form="op.logoutForm" name="logout" value="yes">Sair</button>' +
      "</body></html>";
}

const provider = new Provider(ISSUER, {
  jwks: { keys: [jwk] },
  cookies: { keys: ["idp-fake-dev-only"] }, // assina cookie do fake; não é segredo
  clients: [
    {
      client_id: "spa-local",
      redirect_uris: [`${SPA_ORIGIN}/callback`],
      post_logout_redirect_uris: [`${SPA_ORIGIN}/`],
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
    rpInitiatedLogout: { enabled: true, logoutSource }, // espelha o logout do IdP real (ADR 0019)
  },
  // accountId == login digitado (mesma forma do default do provider, evita checagens cruzadas
  // grant/sessão/token). sub = login; name/email fixos, salvo os logins de BROKEN_USERS, que
  // emitem claims malformadas de propósito, e name-vazio. Sugerido: fake-user-1.
  async findAccount(_ctx, id) {
    return {
      accountId: id,
      async claims() {
        return { sub: id, ...(BROKEN_USERS[id] ?? (id === "name-vazio" ? USER_SEM_NAME : USER)) };
      },
    };
  },
});

const app = express();
app.use("/o", provider.callback());
app.listen(PORT, () => {
  console.log(`IdP fake em ${ISSUER}/.well-known/openid-configuration`);
  console.log("login sugerido: fake-user-1 (senha: qualquer)");
  console.log(`logins com claims malformadas: ${Object.keys(BROKEN_USERS).join(", ")}`);
  console.log("login que entra com name vazio: name-vazio");
});
