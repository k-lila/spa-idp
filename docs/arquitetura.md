# Arquitetura da SPA

Mapa do projeto e desenho da SPA como relying party (RP) OIDC (OpenID Connect) do provedor de
identidade (IdP) `nova_api`. As regras que o desenho cumpre (invariantes I1–I8) estão em
`docs/spa-nucleo.md`; o porquê de cada escolha, nas ADRs (Architecture Decision Records) de
`docs/adr/`.

---

## Árvore de arquivos

```
nova_api_SPA/
├── src/
│   ├── main.tsx              # boot: valida config, monta Query → Auth → Router
│   ├── config.ts             # lê e valida as VITE_* (ADR 0005)
│   ├── router.tsx            # rotas: /, /callback, /app (protegida), *
│   ├── index.css             # Tailwind v4
│   ├── auth/                 # tudo o que é OIDC
│   │   ├── userManager.ts    # único contato com oidc-client-ts: signin, completeSignin,
│   │   │                     #   signout, restoreSession (ADR 0006)
│   │   ├── idToken.ts        # único contato com jose: verifica o id_token (ADR 0013)
│   │   ├── claims.ts         # schema zod das claims sub, name, email (ADR 0007)
│   │   ├── AuthContext.ts    # tipo do estado (loading | anonymous | authenticated) e useAuth
│   │   ├── AuthProvider.tsx  # traduz eventos do UserManager em estado React
│   │   └── RequireAuth.tsx   # guarda de rota por redirect (I8)
│   ├── api/
│   │   ├── http.ts           # authGet: anexa Bearer, 401 → re-auth (ADR 0008)
│   │   ├── userinfo.ts       # useUserinfo, chaveado pelo sub (ADR 0009)
│   │   └── queryClient.ts    # cliente do TanStack Query
│   └── pages/
│       ├── Landing.tsx       # "Entrar"; aviso de logout que não chegou ao IdP
│       ├── Callback.tsx      # troca o code; autenticando | erro
│       ├── Area.tsx          # claims do id_token e do userinfo; "Sair"
│       └── NotFound.tsx
├── dev/idp-fake/server.js    # IdP fake (oidc-provider) para os e2e (ADR 0004)
├── e2e/                      # Playwright contra o IdP fake
├── docs/
│   ├── spa-nucleo.md         # stack e invariantes
│   ├── arquitetura.md        # este documento
│   └── adr/                  # decisões (0001–0019)
├── .github/workflows/ci.yml  # typecheck, lint, format, testes unitários
├── vercel.json               # rewrite para /index.html e cabeçalhos (ADR 0016)
├── vite.config.ts            # plugins React e Tailwind, porta 5173, Vitest
├── .env.example              # modelo das VITE_*
└── CLAUDE.md                 # regras de trabalho
```

Os testes unitários ficam ao lado do arquivo que testam (`*.test.ts[x]`).

---

## Arquitetura

### Contexto: duas origens, um navegador

A SPA é estática: a Vercel entrega HTML, JS e CSS, e nada roda no servidor. Todo o protocolo
acontece no navegador, contra o IdP em outra origem (Cloudflare Tunnel em produção, ADR 0018;
`http://localhost:8000/o` em desenvolvimento).

```
                 ┌──────────────────────── navegador ─────────────────────────┐
  Vercel ──HTML/JS──▶  SPA (https://<spa>)                                    │
                 │       │                                                    │
                 │       ├─ navegação ──▶ /o/authorize/      login, consentimento
                 │       ├─ navegação ──▶ end_session_endpoint   logout (ADR 0019)
                 │       ├─ fetch ──────▶ /.well-known/openid-configuration
                 │       ├─ fetch ──────▶ jwks_uri           chave pública RS256
                 │       ├─ fetch (CORS)▶ /o/token/          code + code_verifier → tokens
                 │       └─ fetch (CORS)▶ /o/userinfo/       Bearer access_token
                 └────────────────────────────────────────────────────────────┘
                                          │
                                  IdP nova_api (https://<idp>/o)
```

Duas naturezas de chamada:

- **Navegação de página inteira** (authorize, logout): a SPA é descarregada e o IdP assume a tela.
  A senha só é digitada ali (I1, I8). O cookie de sessão do IdP (`SameSite=Lax`) viaja nessas
  navegações, e é ele que devolve o usuário sem senha num novo login (SSO).
- **`fetch` cruzando origem** (descoberta, JWKS, token, userinfo): depende da allowlist de CORS
  (Cross-Origin Resource Sharing) do IdP conter a origem exata da SPA.

Só o issuer vem da configuração; todos os endpoints saem da descoberta (I5).

### Camadas

```
 pages/         Landing · Callback · Area            telas; não conhecem a biblioteca OIDC
    │
 auth/          AuthProvider · RequireAuth · useAuth estado React e guarda de rota
    │
 auth/          userManager.ts ──▶ oidc-client-ts    protocolo (único ponto de contato)
                idToken.ts ──────▶ jose              verificação criptográfica
                claims.ts ───────▶ zod               contrato das claims
    │
 api/           http.ts (authGet) · userinfo.ts      chamadas autenticadas
    │
 config.ts      VITE_OIDC_ISSUER, _CLIENT_ID, _REDIRECT_URI, _POST_LOGOUT_REDIRECT_URI
```

Cada biblioteca externa entra por um arquivo só. `User` e `access_token` não saem de
`userManager.ts` e `http.ts`: as telas recebem apenas as claims já validadas pelo contexto.

### Estado e onde ele vive

| O quê | Onde | Por quê |
|---|---|---|
| Tokens (`id_token`, `access_token`, `refresh_token`) | memória (`InMemoryWebStorage`) | I3; somem no reload |
| `state`, `nonce`, `code_verifier` | `sessionStorage` (padrão da lib), só durante o redirect | a página é descarregada; não são tokens |
| Marcador de re-auth (`spa.reauth`) | `sessionStorage` | corta o laço 401 → IdP → 401 (ADR 0008) |
| Estado de autenticação | `AuthContext` | `loading` → `anonymous` \| `authenticated` com claims |
| Resposta do userinfo | cache do TanStack Query, chave `["userinfo", sub]` | limpo quando a sessão acaba |

O `refresh_token` é recebido e nunca usado; não há renovação silenciosa (ADR 0014).

### Fluxos

**Login (authorization code + PKCE).**

1. "Entrar" (Landing) ou a guarda de `/app` (`RequireAuth`) chama `signin(returnTo?)`.
2. A biblioteca gera `code_verifier` e `nonce`, guarda o destino no `state` (ADR 0011) e navega
   a `/o/authorize/`.
3. O IdP autentica e volta a `/callback?code=…&state=…`.
4. `Callback` chama `completeSignin()`: a biblioteca confere o `state` e troca o `code` em
   `/o/token/`; `jose` verifica assinatura, `iss`, `aud`, `alg` e `exp` do `id_token` contra o
   JWKS (I4); zod valida as claims (I7). Qualquer falha descarta os tokens e mostra o erro.
5. `AuthProvider` recebe o evento `userLoaded`, passa a `authenticated`, e `Callback` navega ao
   destino, restrito à própria origem (ADR 0011).

**Reload.** A memória zera. `restoreSession()` responde "sem sessão"; em `/app` a guarda refaz o
login, e o SSO do IdP devolve o usuário sem pedir senha (ADR 0014).

**Userinfo.** `Area` chama `useUserinfo(sub)` → `authGet` anexa o `Bearer`. A resposta passa pelo
mesmo schema zod e precisa trazer o mesmo `sub` do `id_token` (ADR 0009). Um `401` dispara um novo
login, uma vez por aba; o segundo `401` seguido vira erro (ADR 0008).

**Logout.** "Sair" chama `signoutRedirect()` sem `state` (ADR 0019): a biblioteca esquece os
tokens, o cache do userinfo é limpo, e a página vai ao `end_session_endpoint`, que encerra a
sessão no IdP e volta a `/`. Se a navegação não sai, a landing avisa que a sessão no IdP
continua.

### Fronteiras de confiança

Nada que chega da rede é aceito pelo tipo estático:

- `id_token`: assinatura e claims de registro (`jose`), `nonce` (biblioteca), claims de
  identidade (zod).
- userinfo: zod e `sub` igual ao do `id_token`.
- destino pós-login: só caminho da própria origem.
- configuração: `config.ts` falha no boot se faltar ou for inválida alguma `VITE_*`.

O `access_token` da RP só lê identidade: `authGet` só faz `GET` (I1).

### Ambientes

| Ambiente | IdP | Uso |
|---|---|---|
| Produção | Vercel → IdP pelo Cloudflare Tunnel | variáveis no painel da Vercel (ADRs 0016, 0017) |
| Preview | nenhum | a aplicação falha no boot, deliberadamente (ADR 0016) |
| Desenvolvimento | IdP real em `http://localhost:8000/o` | `.env.local` |
| e2e | IdP fake em `http://localhost:9000/o` | `npm run test:e2e` sobe fake e SPA |
