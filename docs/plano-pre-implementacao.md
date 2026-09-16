# Plano de pré-implementação — SPA

| Campo | Valor |
|---|---|
| Status | proposto — 2026-09-14 |
| Depende de | `spa-nucleo.md`, `frontend-mapa-comportamento.md`, `backend-mapa-comportamento.md` |
| Decisões fixadas aqui | D1 = `oidc-client-ts`; D2 = gestão de conta linkada ao IdP; dev contra IdP fake local |
| Decisões ainda abertas | mecanismo de sobrevivência ao reload (§7); assinatura do `id_token` com `oidc-client-ts` (§7) |

Este documento fecha o que a conversa de UX decidiu e ordena a implementação da
aplicação de página única (SPA) que atua como Relying Party do provedor de identidade
(IdP). Ele não substitui o núcleo nem os mapas: onde eles dizem DEVE, isto aqui só
detalha como.

---

## §1. O que a SPA precisa demonstrar

Se a área autenticada renderiza `sub`, `name` e `email` vindos do IdP, o fluxo inteiro
funcionou: discovery, redirect com PKCE (Proof Key for Code Exchange), callback, troca de
`code`, validação do `id_token`. Essa tela é o critério de pronto do projeto; todo o
resto serve a ela.

---

## §2. Fluxo de UX

### Rotas

| Rota | Acesso | Papel |
|---|---|---|
| `/` | público | Landing: "Entrar" e "Registrar-se" |
| `/callback` | público | Recebe `code` + `state`; nunca é destino final |
| `/app` | protegido | Área autenticada: perfil e "Sair" |
| `*` | público | Não encontrado; volta para `/` |

### Telas e estados

1. **Landing (`/`).** Dois botões. "Entrar" inicia o redirect a `/o/authorize/`.
   "Registrar-se" é link externo às páginas server-side do IdP (D2). Se já há sessão em
   memória, redireciona para `/app`.
2. **Callback (`/callback`).** Três estados: *autenticando* (padrão), *erro* (`state`
   inválido, `code` rejeitado, rede/CORS) e *sucesso* (redireciona para o destino guardado
   ou para `/app`). O erro mostra uma mensagem e um botão que volta para `/`.
3. **Área autenticada (`/app`).** Exibe `sub`, `name` e `email`; links para "Editar perfil"
   no IdP; botão "Sair". Sem senha, sem formulário.
4. **Sair.** Esquece os tokens e navega para `/`. Enquanto o `end_session_endpoint` não
   existir, o texto avisa que a sessão no provedor de identidade continua ativa.
5. **Boot sem token** (reload ou primeira visita). Chama `restoreSession()` — ponto de
   encaixe do §7. Enquanto o mecanismo não é definido, retorna "sem sessão" e o
   comportamento é o da rota: `/` mostra a landing, `/app` redireciona ao login.
6. **Deep-link.** Rota protegida sem sessão guarda o destino no `state` do redirect
   (`signinRedirect({ state: { returnTo } })`) e o callback restaura.

---

## §3. Contrato com o back-end (o que a SPA assume)

| Item | Assumido | Origem |
|---|---|---|
| Issuer | `{BASE_URL}/o` | mapa back-end |
| Discovery | `{issuer}/.well-known/openid-configuration` | I5 |
| Endpoints | `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `userinfo_endpoint` via discovery | I5 |
| Client | público, sem secret, `response_type=code`, PKCE `S256` obrigatório | mapa back-end |
| Scopes | `openid profile email` | claims afirmadas |
| Claims | `sub`, `name`, `email`; **sem** `email_verified` | mapa back-end |
| Assinatura | RS256, chave publicada em `jwks_uri` (JSON Web Key Set, JWKS) | I4 |
| CORS (Cross-Origin Resource Sharing) | origem da SPA liberada em `/o/token/` e `/o/userinfo/` | mapa back-end |
| `redirect_uri` | igualdade exata com a registrada | mapa back-end |

Pontos de encaixe (a SPA já deixa o lugar, o back-end preenche depois):

- **Sessão no reload** — função `restoreSession()` (§7).
- **Logout real** — se o discovery anunciar `end_session_endpoint`, "Sair" passa a usá-lo.
- **URL das páginas de conta** — cadastro e edição de perfil. Não é descoberto por OIDC
  (OpenID Connect); entra por variável de ambiente até o back-end fixar os caminhos.

---

## §4. Configuração por ambiente

| Variável | Uso |
|---|---|
| `VITE_OIDC_ISSUER` | base do discovery (`{BASE_URL}/o`) |
| `VITE_OIDC_CLIENT_ID` | `client_id` da `Application` |
| `VITE_OIDC_REDIRECT_URI` | URL de `/callback` deste deploy |
| `VITE_IDP_ACCOUNT_URL` | base das páginas server-side de conta |

`.env.example` commitado com valores do IdP fake; `.env.local` ignorado pelo git (I6).
Lidas uma vez em `src/config.ts` e validadas com zod — falta de variável falha no boot,
não na primeira chamada.

---

## §5. Estrutura do projeto

```
src/
  config.ts            # VITE_* validadas com zod
  auth/
    userManager.ts     # oidc-client-ts: UserManager com userStore em memória
    AuthProvider.tsx   # contexto: user, signin, signout, restoreSession
    RequireAuth.tsx    # guarda de rota por redirect (I8)
    claims.ts          # schema zod das claims (I7)
  api/
    http.ts            # wrapper de fetch: Bearer, 401 → re-auth
  pages/
    Landing.tsx  Callback.tsx  App.tsx  NotFound.tsx
  main.tsx  router.tsx
dev/
  idp-fake/            # §6
```

Decisões de configuração do `oidc-client-ts`:

- `userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() })` — tokens
  só em memória (I3).
- `stateStore` fica no padrão (`sessionStorage`): guarda `state`, `nonce` e
  `code_verifier` **durante** o redirect. Não é token; I3 não se aplica.
- `response_type: "code"`, `scope: "openid profile email"`, `loadUserInfo: false` no
  início (claims vêm do `id_token`; `userinfo` entra com TanStack Query na etapa 5).
- `automaticSilentRenew: false` até o §7 ser decidido.

---

## §6. IdP fake local

Servidor Node em `dev/idp-fake/` usando `oidc-provider`, publicado em
`http://localhost:9000/o` para reproduzir o issuer com sufixo `/o`. Configuração mínima:
um client público com PKCE S256, um usuário fixo com `sub`/`name`/`email`, chave RS256
gerada no boot, CORS liberando `http://localhost:5173`. Sobe com `npm run idp`.

O fake existe para exercitar o **redirect real** e os testes e2e. Ele não substitui a
validação contra o `monolito-idp` quando ele tiver endereço — essa é a última etapa do §8.

---

## §7. Decisões que aguardam o mantenedor

1. **Assinatura do `id_token`.** `oidc-client-ts` (v2+) valida `iss`, `aud`, `exp` e
   `nonce`, mas **não verifica a assinatura** via JWKS — confia no canal TLS do token
   endpoint. O invariante I4 exige a verificação. Opções:
   - *Acrescentar verificação com `jose`* após o `signinCallback`, usando `jwks_uri` do
     discovery. Pró: I4 preservado. Contra: código a mais fora da biblioteca.
   - *Relaxar I4 por ADR*, aceitando a justificativa da biblioteca. Pró: menos código.
     Contra: muda um invariante do núcleo.
2. **Sessão no reload.** `restoreSession()` nasce vazia. Candidatos:
   - *Silent auth via `prompt=none`* (redirect top-level). Só OIDC padrão; um redirect por
     reload.
   - *Renovação via back-end* (cookie HttpOnly + endpoint próprio). Sem redirect; exige
     cookie cross-site, que o mapa do back-end descarta.
   A escolha é do back-end; a SPA implementa o que for decidido dentro da função.
3. **Caminhos das páginas de conta** no IdP (`/accounts/...`), para preencher
   `VITE_IDP_ACCOUNT_URL`.

Cada decisão fechada vira um registro de decisão de arquitetura (ADR) em `docs/adr/`.

---

## §8. Ordem de implementação

| # | Etapa | Pronto quando |
|---|---|---|
| 1 | Scaffold: Vite + React + TS `strict` + ESLint + Prettier + Tailwind + React Router | `typecheck`, `lint` e `build` verdes; landing renderiza |
| 2 | IdP fake (§6) + `.env.example` + `src/config.ts` | discovery do fake responde; boot falha sem variável |
| 3 | Auth: `userManager`, `AuthProvider`, `/callback`, `RequireAuth` | login contra o fake chega em `/app` com as claims |
| 4 | Validação de borda: zod nas claims; `jose` se o §7.1 aprovar | claim malformada cai no estado de erro do callback |
| 5 | `api/http.ts` + TanStack Query em `userinfo` | `/app` mostra dados do `userinfo`; 401 dispara re-auth |
| 6 | Sair, deep-link, estados de erro, `NotFound` | fluxo completo sem caminho morto |
| 7 | Testes: Vitest (config, claims, guarda); Playwright e2e contra o fake | suíte verde no CI |
| 8 | CI (typecheck/lint/test) + deploy Vercel | preview publicado |
| 9 | Validação contra o `monolito-idp` real | login em produção chega em `/app` |

A etapa 9 depende do back-end ter endereço, CORS e `Application` registrada; as
anteriores não.

---

## §9. Fora deste plano

- Gestão de conta dentro da SPA (D2 ficou em "linkar ao IdP").
- Logout real (adaptação de back-end).
- Estado global além de sessão; biblioteca de UI além de shadcn/Radix.

---

## §10. Checklist de implementação

Acompanha o §8. Marcar quando o critério "Pronto quando" da etapa for atendido.

- [x] 1. Scaffold: Vite + React + TS `strict` + ESLint + Prettier + Tailwind + React Router
- [x] 2. IdP fake (§6) + `.env.example` + `src/config.ts`
- [x] 3. Auth: `userManager`, `AuthProvider`, `/callback`, `RequireAuth`
- [x] 4. Validação de borda: zod nas claims; `jose` se o §7.1 aprovar
- [x] 5. `api/http.ts` + TanStack Query em `userinfo`
- [ ] 6. Sair, deep-link, estados de erro, `NotFound`
- [ ] 7. Testes: Vitest (config, claims, guarda); Playwright e2e contra o fake
- [ ] 8. CI (typecheck/lint/test) + deploy Vercel
- [ ] 9. Validação contra o `monolito-idp` real
