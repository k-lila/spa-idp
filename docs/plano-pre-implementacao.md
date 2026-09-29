# Plano de pré-implementação — SPA

| Campo | Valor |
|---|---|
| Status | proposto — 2026-09-14 |
| Depende de | `spa-nucleo.md`, `contrato-frontend.md` |
| Decisões fixadas aqui | D1 = `oidc-client-ts`; D2 = gestão de conta linkada ao IdP — **emendada pela ADR 0012: sem páginas de conta nesta fase**; dev contra IdP fake local; verificação do `id_token` com `jose` — **ADR 0013**; sessão no reload por redirect + SSO — **ADR 0014** |

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
| `/` | público | Landing: "Entrar" |
| `/callback` | público | Recebe `code` + `state`; nunca é destino final |
| `/app` | protegido | Área autenticada: perfil e "Sair" |
| `*` | público | Não encontrado; volta para `/` |

### Telas e estados

1. **Landing (`/`).** Um botão: "Entrar" inicia o redirect a `/o/authorize/`. Se já há
   sessão em memória, redireciona para `/app`.
2. **Callback (`/callback`).** Três estados: *autenticando* (padrão), *erro* (`state`
   inválido, `code` rejeitado, rede/CORS) e *sucesso* (redireciona para o destino guardado
   ou para `/app`). O erro mostra uma mensagem e um botão que volta para `/`.
3. **Área autenticada (`/app`).** Exibe `sub`, `name` e `email`; botão "Sair". Sem senha,
   sem formulário.
4. **Sair.** Vai ao `end_session_endpoint` da descoberta, que encerra a sessão no IdP e volta
   a `/` (ADR 0019). Se o logout não sai (descoberta fora ou sem o endpoint), os tokens já foram
   esquecidos e a landing avisa que a sessão no provedor de identidade não foi encerrada.
5. **Boot sem token** (reload ou primeira visita). Chama `restoreSession()` — ponto de
   encaixe do §7. Enquanto o mecanismo não é definido, retorna "sem sessão" e o
   comportamento é o da rota: `/` mostra a landing, `/app` redireciona ao login.
6. **Deep-link.** Rota protegida sem sessão guarda o destino no `state` do redirect
   (`signinRedirect({ state: { returnTo } })`) e o callback restaura.

Emenda (ADR 0012): "Registrar-se" e "Editar perfil" saíram — o IdP não tem páginas de
conta nesta fase.

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
- **Logout real** — preenchido: "Sair" usa o `end_session_endpoint` do discovery (ADR 0019).

---

## §4. Configuração por ambiente

| Variável | Uso |
|---|---|
| `VITE_OIDC_ISSUER` | base do discovery (`{BASE_URL}/o`) |
| `VITE_OIDC_CLIENT_ID` | `client_id` da `Application` |
| `VITE_OIDC_REDIRECT_URI` | URL de `/callback` deste deploy |
| `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` | URL da landing `/` deste deploy, volta do "Sair" |

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

1. **Verificação do `id_token`.** Fechado pela ADR 0013: `oidc-client-ts` 3.5.0 valida só
   `sub` e `nonce`; a SPA verifica com `jose`, em `completeSignin()` e antes das claims, a
   assinatura (JWKS do `jwks_uri` da descoberta, RS256), `iss` por igualdade exata com
   `VITE_OIDC_ISSUER`, `aud` = `client_id` e `exp` com tolerância. I4 cumprido.
2. **Sessão no reload.** Fechado pela ADR 0014: redirect ao IdP + SSO. `restoreSession()`
   consulta só a memória e após reload responde "sem sessão"; a rota protegida vai a
   `/o/authorize/` e o cookie de sessão do IdP (`SameSite=Lax`, navegação top-level) devolve
   sem senha. Reload sem tela de consentimento depende de `skip_authorization` na
   `Application` da SPA (`nova_api/docs/plano-implantacao.md` §2.4). Nada de token fora da
   memória: `sessionStorage` + `refresh_token` foi descartado porque o `refresh_token` do IdP
   não expira. Candidatos descartados: silent auth `prompt=none` (mesmo custo, e em iframe
   depende de cookie cross-site que o fake same-site mascara) e renovação via back-end com
   cookie (o `plano-implantacao.md` do IdP não prevê cookie cross-site nem endpoint próprio).
3. **Caminhos das páginas de conta.** Fechado pela ADR 0012: o IdP não tem páginas de
   conta nesta fase; `VITE_IDP_ACCOUNT_URL` foi removida.

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

- Gestão de conta — dentro da SPA ou linkada ao IdP (D2 emendada pela ADR 0012: sem
  páginas de conta nesta fase).
- Logout real (adaptação de back-end). Entregue depois, pela ADR 0019.
- Estado global além de sessão; biblioteca de UI além de shadcn/Radix.

---

## §10. Checklist de implementação

Acompanha o §8. Marcar quando o critério "Pronto quando" da etapa for atendido.

- [x] 1. Scaffold: Vite + React + TS `strict` + ESLint + Prettier + Tailwind + React Router
- [x] 2. IdP fake (§6) + `.env.example` + `src/config.ts`
- [x] 3. Auth: `userManager`, `AuthProvider`, `/callback`, `RequireAuth`
- [x] 4. Validação de borda: zod nas claims; `jose` se o §7.1 aprovar
- [x] 5. `api/http.ts` + TanStack Query em `userinfo`
- [x] 6. Sair, deep-link, estados de erro, `NotFound`
- [x] 7. Testes: Vitest (config, claims, guarda); Playwright e2e contra o fake
- [ ] 8. CI (typecheck/lint/test) + deploy Vercel
- [ ] 9. Validação contra o `monolito-idp` real
