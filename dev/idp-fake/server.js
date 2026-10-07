import { generateKeyPairSync } from "node:crypto";
import express from "express";
import Provider from "oidc-provider";

// IdP fake dos e2e (ADRs 0004, 0020): o oidc-provider em /o, a API de conta em /api/conta/ no
// mesmo processo (a origem é a do issuer) e as contas em memória. Não serve as páginas
// /accounts/… do IdP real; as diferenças estão em docs/contrato-idp.md §9.

const PORT = 9000;
const ISSUER = `http://localhost:${PORT}/o`; // sufixo /o espelha o IdP real
const SPA_ORIGIN = "http://localhost:5173"; // única fonte p/ redirect_uri e CORS
const CLIENT_ID = "spa-local";
const EMAIL = "teste@example.com";
const TERMOS_VERSAO_VIGENTE = "1";
const MAX_LENGTH = 150; // limite do IdP real para first_name, last_name e nickname
// Logins que emitem claims malformadas (etapa 4): a SPA deve cair no estado de erro do callback.
// Não passam pelas contas: emitem só estas claims.
const BROKEN_USERS = {
  "sem-name": { email: EMAIL },
  "sem-email": { name: "Usuária de Teste" },
  "name-numero": { name: 42, email: EMAIL },
};
// Estados particulares de conta, escolhidos pelo trecho do login antes do primeiro ":".
// `sem-aceite:<sufixo>` nasce sem aceite; um sufixo novo por execução dá ao e2e uma conta nova,
// já que as contas vivem o processo inteiro e o servidor é reaproveitado entre execuções locais
// (reuseExistingServer). `name-vazio` emite `name: ""` (usuário sem nome no IdP real) e deve
// entrar normalmente.
const SPECIAL_USERS = {
  "name-vazio": { first_name: "", last_name: "" },
  "sem-aceite": { termos_versao: "" },
  "nao-confirmado": { email_verified: false },
};

// Contas em memória, criadas no primeiro uso de cada login; nada sobrevive ao restart. O padrão
// já confirmou o e-mail e aceitou os termos vigentes, para os e2e seguirem direto a /app.
const contas = new Map();
function contaDe(id) {
  if (!contas.has(id)) {
    const agora = new Date();
    contas.set(id, {
      sub: id,
      email: EMAIL,
      email_verified: true,
      first_name: "Usuária",
      last_name: "de Teste",
      nickname: "",
      date_joined: agora,
      updated_at: agora,
      senha_alterada_em: null,
      termos_versao: TERMOS_VERSAO_VIGENTE,
      ...SPECIAL_USERS[id.split(":")[0]],
    });
  }
  return contas.get(id);
}

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
  scopes: ["openid", "offline_access", "conta"], // `conta` só libera a API, não claim
  claims: {
    openid: ["sub"],
    profile: ["name", "nickname", "updated_at"],
    email: ["email", "email_verified"],
  },
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
  // grant/sessão/token). sub = login; as claims vêm da conta em memória, salvo os logins de
  // BROKEN_USERS, que emitem claims malformadas de propósito. Sugerido: fake-user-1.
  async findAccount(_ctx, id) {
    return {
      accountId: id,
      async claims() {
        if (id in BROKEN_USERS) return { sub: id, ...BROKEN_USERS[id] };
        const c = contaDe(id);
        return {
          sub: id,
          name: `${c.first_name} ${c.last_name}`.trim(), // get_full_name() do IdP real
          nickname: c.nickname,
          updated_at: Math.floor(c.updated_at.getTime() / 1000),
          email: c.email,
          email_verified: c.email_verified,
        };
      },
    };
  },
});

// prompt=create (ADR 0020, D-10): o oidc-provider recusa o valor com invalid_request; o fake não
// tem página de cadastro e só retira `create` antes de seguir ao login. `originalUrl` muda junto
// porque o provider deriva dele o caminho de montagem.
function semCreate(req, _res, next) {
  const url = new URL(req.url, ISSUER);
  if (url.pathname === "/o/auth" && url.searchParams.has("prompt")) {
    const prompt = url.searchParams
      .get("prompt")
      .split(" ")
      .filter((p) => p !== "" && p !== "create");
    if (prompt.length === 0) url.searchParams.delete("prompt");
    else url.searchParams.set("prompt", prompt.join(" "));
    req.url = req.originalUrl = url.pathname + url.search;
  }
  next();
}

// API de conta: corpos e erros de docs/contrato-idp.md §11.1. Sem teto de requisições e sem
// conta_inativa. O CORS é escrito à mão: o clientBasedCORS só vale nas rotas do provider.
const api = express.Router();

api.use((req, res, next) => {
  res.set({
    "Access-Control-Allow-Origin": SPA_ORIGIN,
    "Access-Control-Expose-Headers": "WWW-Authenticate, Retry-After",
  });
  if (req.method !== "OPTIONS") return next();
  res
    .set({
      "Access-Control-Allow-Methods": "GET, PATCH, POST",
      "Access-Control-Allow-Headers": "authorization, content-type",
    })
    .status(204)
    .end();
});

// Desafios como os do real, sem o `resource_metadata`: o fake não publica esse documento, e
// apontar para um caminho que dá 404 seria inventar.
api.use(async (req, res, next) => {
  const authorization = req.get("authorization");
  if (authorization === undefined) {
    return res.status(401).set("WWW-Authenticate", "Bearer").end(); // sem `error` (RFC 6750 §3.1)
  }
  const [, value] = /^Bearer (.+)$/.exec(authorization) ?? [];
  const token = await provider.AccessToken.find(value);
  if (token === undefined) {
    return res.status(401).set("WWW-Authenticate", 'Bearer error="invalid_token"').end();
  }
  if (!token.scope?.split(" ").includes("conta")) {
    return res
      .status(403)
      .set(
        "WWW-Authenticate",
        'Bearer error="insufficient_scope",error_description="The access token is valid but does not have enough scope."',
      )
      .end();
  }
  if (token.clientId !== CLIENT_ID) {
    return res.status(403).json({ codigo: "aplicacao_nao_autorizada" });
  }
  res.locals.conta = contaDe(token.accountId);
  next();
});

api.use(express.json());

function erros(res, campos) {
  res.status(400).json({ erros: campos });
}
function erro(codigo, mensagem) {
  return [{ codigo, mensagem }];
}
const JSON_INVALIDO = { geral: erro("json_invalido", "The request body must be a JSON object.") };
function jsonObjeto(req, res) {
  const ok = typeof req.body === "object" && req.body !== null && !Array.isArray(req.body);
  if (!ok) erros(res, JSON_INVALIDO);
  return ok;
}

function corpo(c) {
  return {
    ...c,
    date_joined: c.date_joined.toISOString(),
    updated_at: c.updated_at.toISOString(),
    senha_alterada_em: c.senha_alterada_em?.toISOString() ?? null,
    termos_versao_vigente: TERMOS_VERSAO_VIGENTE,
  };
}

api.get("/", (_req, res) => res.json(corpo(res.locals.conta)));

// Lista fechada: campo ausente não muda; `null` vale "". Sem nenhum campo da lista, nada se grava
// e `updated_at` fica como está.
api.patch("/", (req, res) => {
  if (!jsonObjeto(req, res)) return;
  const mudancas = {};
  const falhas = {};
  for (const campo of ["first_name", "last_name", "nickname"]) {
    if (!(campo in req.body)) continue;
    const valor = req.body[campo] ?? "";
    if (typeof valor !== "string") {
      falhas[campo] = erro("invalid", "Enter a string.");
    } else if (valor.length > MAX_LENGTH) {
      falhas[campo] = erro(
        "max_length",
        `Ensure this value has at most ${MAX_LENGTH} characters (it has ${valor.length}).`,
      );
    } else {
      mudancas[campo] = valor;
    }
  }
  if (Object.keys(falhas).length > 0) return erros(res, falhas);
  if (Object.keys(mudancas).length > 0) {
    Object.assign(res.locals.conta, mudancas, { updated_at: new Date() });
  }
  res.json(corpo(res.locals.conta));
});

api.post("/confirmacao/", (_req, res) => res.status(204).end());

api.post("/termos/", (req, res) => {
  if (!jsonObjeto(req, res)) return;
  if (req.body.versao === undefined) {
    return erros(res, { versao: erro("required", "This field is required.") });
  }
  if (req.body.versao !== TERMOS_VERSAO_VIGENTE) {
    return erros(res, {
      versao: erro("termos_desatualizados", "This is not the current version of the terms."),
    });
  }
  res.locals.conta.termos_versao = TERMOS_VERSAO_VIGENTE;
  res.status(204).end();
});

api.use((err, _req, res, next) => {
  if (err.type !== "entity.parse.failed") return next(err);
  erros(res, JSON_INVALIDO);
});

const app = express();
app.use(semCreate);
app.use("/api/conta", api);
app.use("/o", provider.callback());
app.listen(PORT, () => {
  console.log(`IdP fake em ${ISSUER}/.well-known/openid-configuration`);
  console.log("login sugerido: fake-user-1 (senha: qualquer)");
  console.log(`logins com claims malformadas: ${Object.keys(BROKEN_USERS).join(", ")}`);
  console.log(
    `logins com conta particular (aceitam ":<sufixo>"): ${Object.keys(SPECIAL_USERS).join(", ")}`,
  );
});
