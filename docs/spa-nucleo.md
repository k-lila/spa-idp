# Núcleo da SPA — Declaração de Arquitetura

| Campo | Valor |
|---|---|
| Componente | SPA — Relying Party OIDC |
| Back-end | `k-lila/monolito-idp` (Django · OIDC IdP) |
| Stack base | React + TypeScript + Tailwind |
| Deploy | Vercel (front) · Render/AWS (back) — **cross-origin** |
| Modelo de confiança | autorização por **token** (redirect + PKCE) |
| Status | núcleo definido; itens em aberto marcados em §5 |
| Audiência | time de subagentes de implementação |
| Documentos irmãos | `backend-mapa-comportamento.md`, `frontend-mapa-comportamento.md` |

---

## §0. Como ler este documento

Palavras normativas: **DEVE** (obrigatório), **NÃO DEVE** (proibido),
**PODE** (permitido, a critério do implementador). Onde este documento diz
DEVE ou NÃO DEVE, um subagente **não tem autonomia** para divergir. Onde diz
PODE, tem. Decisões ainda não tomadas estão em §5 e **não devem ser resolvidas
unilateralmente** por um subagente — aguardam definição do mantenedor.

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

## §3. Núcleo (decidir e montar primeiro; molda todo o resto)

| Camada | Escolha | Papel |
|---|---|---|
| Build / dev server | **Vite** | Build e dev server; proxy de dev para simular mesmo origin contra o back-end |
| Rigor de tipos | **TS `strict` + ESLint + Prettier** | Erro de contrato em compile-time; espelha o rigor do back-end |
| Roteamento | **React Router** | Rota de callback, guarda de rota (I8), deep-link |
| Auth / OIDC | **`oidc-client-ts` _ou_ PKCE à mão** (ver §5, D1) | PKCE, troca de token, validação do `id_token` (I4), silent renew |
| Cliente HTTP | **wrapper de `fetch`** (interceptors) | Anexa `Bearer`; trata `401` → re-auth |
| Estado de servidor | **TanStack Query** | Cache de dados remotos (`userinfo`/conta), revalidação, loading/erro |
| Config por ambiente | **Vite env (`VITE_*`)** | `issuer`, `client_id`, `redirect_uri` por ambiente (I6); cobre o problema das preview URLs |
| Validação de borda | **zod** | Valida claims e payloads em runtime (I7) |

---

## §4. Suporte (necessário, porém mais leve ou adiável)

| Camada | Escolha | Condição |
|---|---|---|
| Estado de UI | React nativo (context/`useReducer`); Zustand só se crescer | O único estado global real é sessão/auth |
| Formulários | react-hook-form + zod | **Somente se** a gestão de conta viver na SPA (ver §5, D2) |
| Primitivos de UI | Tailwind + shadcn/ui (Radix) | Acessibilidade (foco, teclado) por cima do Tailwind |
| Testes | Vitest + Testing Library; Playwright p/ e2e | O fluxo de redirect/auth é e2e por natureza |
| Erro + CI | Error Boundary; typecheck/lint/test antes do deploy | Cobre caminhos de falha de auth/rede; gate antes de preview/prod |

---

## §5. Decisões em aberto (NÃO resolver unilateralmente)

- **D1 — Biblioteca OIDC vs PKCE à mão.** `oidc-client-ts` (correto, menos
  código) versus implementar PKCE à mão (mais linhas, demonstra domínio do
  protocolo — mais legível como portfólio). É a única decisão de arquitetura
  real do núcleo. **Aguardar definição do mantenedor.**
- **D2 — Onde vive a gestão de conta** (cadastro, edição de perfil): dentro da
  SPA, ou linkada às páginas server-side do IdP. Esta decisão **fecha a metade de
  suporte** da tabela (formulários e parte do estado de UI só entram se for
  "dentro da SPA"). **Aguardar definição do mantenedor.**

---

## §6. Restrições (lista de varredura rápida)

- **NÃO DEVE** persistir token fora da memória (I3).
- **NÃO DEVE** criar tela ou campo de senha na SPA (I8).
- **NÃO DEVE** hardcodar `issuer`, `client_id` ou `redirect_uri` (I6).
- **NÃO DEVE** chamar a API de conta com o `access_token` da RP — confusão de
  audiência (I1); enquanto D2 estiver aberto, não construir essa chamada.
- **NÃO DEVE** adicionar estado global pesado (Redux/MobX): o único global real
  é sessão/auth.
- **NÃO DEVE** introduzir biblioteca de UI pesada; primitivos vêm de
  shadcn/Radix sobre Tailwind.
- **NÃO DEVE** resolver D1 ou D2 por conta própria (§5).
