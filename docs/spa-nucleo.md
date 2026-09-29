# Núcleo da SPA — Declaração de Arquitetura

| Campo | Valor |
|---|---|
| Componente | SPA — Relying Party OIDC (OpenID Connect) |
| Back-end | `k-lila/monolito-idp` (Django · provedor de identidade, IdP) |
| Stack base | React + TypeScript + Tailwind |
| Deploy | Vercel (SPA) · IdP servido pelo Cloudflare Tunnel (ADRs 0016, 0018) — **cross-origin** |
| Modelo de confiança | autorização por **token** (redirect + PKCE, Proof Key for Code Exchange) |
| Status | em produção; decisões D1 e D2 fechadas (§5) |
| Audiência | time de subagentes de implementação |
| Decisões | `docs/adr/` (ADRs, Architecture Decision Records) |

---

## §0. Como ler este documento

Palavras normativas: **DEVE** (obrigatório), **NÃO DEVE** (proibido),
**PODE** (permitido, a critério do implementador). Onde este documento diz
DEVE ou NÃO DEVE, um subagente **não tem autonomia** para divergir. Onde diz
PODE, tem. As decisões fixadas estão em §5 e nas ADRs; revê-las é do mantenedor,
não de um subagente.

Este documento declara o **núcleo** (stack e invariantes). Ele **não** define
páginas, telas ou layout.

---

## §1. Contexto (leia antes de decidir qualquer coisa)

Esta SPA **não** é um app React genérico. Ela é uma **Relying Party OIDC**
hospedada em origem diferente da do IdP. Toda a lista de stack abaixo decorre
dessa natureza: autenticação por redirect, token em memória, validação de
`id_token`, e configuração que muda por ambiente. Qualquer escolha que
contrarie isso está errada, mesmo que seja "o padrão" em um projeto React comum.

---

## §2. Invariantes (não-negociáveis)

- **I1.** A SPA é uma Relying Party. Ela **NÃO DEVE** se comportar como dona da
  identidade, **NÃO DEVE** coletar senha e **NÃO DEVE** escrever no diretório de
  usuários usando o `access_token` da RP.
- **I2.** Autenticação **DEVE** ser por redirect + PKCE (`S256`). Login e
  consentimento vivem no IdP, em outro origin; a SPA entrega e retoma.
- **I3.** Tokens **DEVEM** viver em memória. **NÃO DEVEM** ser persistidos em
  `localStorage` nem `sessionStorage`.
- **I4.** O `id_token` **DEVE** ser validado antes de ser confiado: assinatura
  via JWKS (RS256), `iss` = `{issuer}`, `aud` = `client_id`, `exp`, `nonce`.
- **I5.** Endpoints **DEVEM** ser descobertos via discovery
  (`/.well-known/openid-configuration`). Apenas o issuer base entra por
  configuração; o resto **NÃO DEVE** ser hardcoded.
- **I6.** `issuer`, `client_id` e `redirect_uri` **DEVEM** vir de variáveis de
  ambiente (`VITE_*`) e **NÃO DEVEM** ser commitados nem fixados no código.
- **I7.** TypeScript **DEVE** rodar em `strict`. Dados que cruzam a borda
  (claims, respostas de API) **DEVEM** ser validados em runtime — o tipo estático
  não valida o que chega da rede.
- **I8.** Guarda de rota **DEVE** ser por redirect: rota protegida sem token
  válido dispara o fluxo de `/o/authorize/`. **NÃO DEVE** existir campo de senha
  na SPA.

---

## §3. Núcleo

| Camada | Escolha | Papel |
|---|---|---|
| Build / dev server | **Vite** | Build e dev server (porta fixa 5173) |
| Rigor de tipos | **TS `strict` + ESLint + Prettier** | Erro de contrato em compile-time; espelha o rigor do back-end |
| Roteamento | **React Router v7**, data router (ADR 0003) | Rota de callback, guarda de rota (I8), deep-link (ADR 0011) |
| Auth / OIDC | **`oidc-client-ts`** (D1, ADR 0006) + **`jose`** (ADR 0013) | PKCE, troca de token, logout (ADR 0019); `jose` verifica o `id_token` (I4). Sem silent renew (ADR 0014) |
| Cliente HTTP | **wrapper de `fetch`** em `src/api/http.ts` (ADR 0008) | Anexa `Bearer`; trata `401` → re-auth |
| Estado de servidor | **TanStack Query** (ADR 0009) | Cache do `userinfo`, chaveado pelo `sub`; loading/erro |
| Config por ambiente | **Vite env (`VITE_*`)** validado em `src/config.ts` (ADR 0005) | Issuer, `client_id`, `redirect_uri` e `post_logout_redirect_uri` por ambiente (I6) |
| Validação de borda | **zod** (ADR 0007) | Valida claims e payloads em runtime (I7) |

---

## §4. Suporte

| Camada | Escolha | Observação |
|---|---|---|
| Estado de UI | React nativo (context) | O único estado global real é sessão/auth |
| Estilo | Tailwind v4 pelo plugin do Vite (ADR 0002) | Sem biblioteca de componentes |
| Testes | Vitest + Testing Library; Playwright p/ e2e | Os e2e rodam contra o IdP fake de `dev/idp-fake/` (ADR 0004) |
| CI | `.github/workflows/ci.yml` | Typecheck, lint, format e testes unitários; e2e só local |
| Deploy | Vercel com `vercel.json` (ADR 0016) | Rewrite para `/index.html`; variáveis por ambiente; previews não autenticam |

---

## §5. Decisões fixadas

- **D1 — Biblioteca OIDC.** `oidc-client-ts`, não PKCE à mão (ADR 0006).
- **D2 — Gestão de conta.** Nenhuma nesta fase: nem na SPA, nem por link ao IdP,
  que não tem páginas de cadastro ou edição de perfil. Contas são criadas pelo admin
  do IdP (ADR 0012).
- **Sessão no reload.** Redirect ao IdP + sessão de login dele (SSO); tokens só em
  memória; o `refresh_token` que o IdP devolve é recebido e nunca usado (ADR 0014).

---

## §6. Restrições (lista de varredura rápida)

- **NÃO DEVE** persistir token fora da memória (I3).
- **NÃO DEVE** usar o `refresh_token` (ADR 0014).
- **NÃO DEVE** criar tela ou campo de senha na SPA (I8).
- **NÃO DEVE** hardcodar issuer, `client_id`, `redirect_uri` ou
  `post_logout_redirect_uri` (I6).
- **NÃO DEVE** chamar a API de conta com o `access_token` da RP — confusão de
  audiência (I1); gestão de conta está fora do escopo (D2).
- **NÃO DEVE** adicionar estado global pesado (Redux/MobX): o único global real
  é sessão/auth.
- **NÃO DEVE** introduzir biblioteca de UI; o estilo é Tailwind.
