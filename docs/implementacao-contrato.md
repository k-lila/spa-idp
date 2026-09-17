# Implementação do contrato — como chegar ao que `contrato-frontend.md` pede

| Campo | Valor |
| --- | --- |
| Origem | `docs/contrato-frontend.md`, §5 a §9 |
| Data | 2026-09-16 |
| Status | estudo, sem código; ordem proposta para as tarefas |
| Critério de pronto | cada passo fecha itens da checklist §9 do contrato; o contrato fecha quando todos os passos fecharem |

O contrato diz **onde** a SPA precisa chegar. Este documento diz **em que ordem** e **com que
cuidados**. Os passos estão ordenados por dependência e por risco; cada um é uma tarefa autônoma
(relatório → código → ADR), com os itens correspondentes da checklist §9 como definição de pronto.
Nada aqui muda decisão do contrato — onde o contrato recomenda, este documento só detalha.

**Princípio de ordenação.** Primeiro deixar plano e configuração coerentes (barato, destrava o
resto). Depois o único item grande e de risco (verificação do `id_token`), enquanto ainda dá para
testar contra o fake. Depois os ajustes pequenos. Depois os artefatos de deploy. Por fim, as
verificações contra o IdP real — em desenvolvimento e em produção —, que dependem do outro
projeto ter cumprido o `contrato-backend.md`.

---

## Passo 1 — Emenda a D2 e coerência do plano

Fecha: contrato §5.3; checklist "Código" (`VITE_IDP_ACCOUNT_URL`, plano emendado) e "Registro"
(ADR da emenda a D2).

### a) Itens

- Remover `VITE_IDP_ACCOUNT_URL` de todos os pontos que a conhecem:
  - `src/config.ts` (`idpAccountUrl`, linha 25) e `src/vite-env.d.ts`;
  - `.env.example` (variável e o comentário "aguardam o plano §7.3");
  - `playwright.config.ts` (`env` do `webServer`);
  - os fakes de config nos testes: `src/config.test.ts` (lista de 4 variáveis → 3; caso
    `idpAccountUrl`), `src/auth/userManager.test.ts`, `src/auth/userManager.lib.test.ts`.
- Emendar `docs/plano-pre-implementacao.md`:
  - §2: "Registrar-se" (linhas ~32 e ~40) e "Editar perfil" (~45) saem;
  - §7.1: o texto afirma que `oidc-client-ts` valida `iss`, `aud` e `exp` — não valida (só
    `sub` e `nonce`); corrigir e apontar para a ADR do passo 2;
  - §7.2 e §7.3: marcar como decididos (ADRs dos passos 3 e 1);
  - tabela de status no topo (D2, "decisões ainda abertas").
- Emendar `CLAUDE.md` da SPA: D2 e a lista "Decisões em aberto".
- ADR: emenda a D2 — sem páginas de conta nesta fase; variável removida — referenciando a ADR
  do IdP "sem páginas de conta nesta fase".

### b) Informações importantes

- Recomendação: **remover** a variável, não torná-la opcional. Nada no código consome
  `idpAccountUrl`; opcional seria configuração morta.
- Vai primeiro porque `config.test.ts` e o `fakeConfig` dos testes de `userManager` serão
  tocados de novo no passo 2; deixá-los limpos antes evita mexer duas vezes no mesmo lugar.
- `config.test.ts` estuba as 4 variáveis em cada caso (imune ao `.env.local`); ao retirar uma,
  revisar o caso "todas presentes" e a contagem declarada (14 casos).
- ADRs aceitas são imutáveis: a emenda a D2 é ADR nova, não edição da 0004 ou da 0006.
- O `.env.example` continua apontando para o fake (`:9000`), com comentário dizendo como apontar
  para o real (`http://localhost:8000/o`) — contrato §6.1.

---

## Passo 2 — Verificar o `id_token` com `jose` (fecha I4)

Fecha: contrato §5.1; checklist "Código" (`jose` integrado) e "Registro" (ADR de I4). Item grande
e de risco; vai sozinho.

### a) Itens

- Dependência `jose` (v6: ESM, Web Crypto) em `dependencies`.
- Função de verificação — sugestão: `src/auth/idToken.ts`, ou dentro de `userManager.ts` —
  chamada em `completeSignin()` **antes** do `claimsSchema.safeParse`:
  `jwtVerify(user.id_token, getKey, { issuer: config.oidc.issuer, audience: config.oidc.clientId, algorithms: ["RS256"], clockTolerance: <segundos> })`.
- `getKey` padrão = `createRemoteJWKSet(new URL(await userManager.metadataService.getKeysEndpoint()))`.
  A `metadataService` é pública em `UserManager`; o `createRemoteJWKSet` recarrega o JWKS ao
  ver `kid` desconhecido — é o que sobrevive à rotação de chave do IdP.
- Falha em qualquer verificação → `await userManager.removeUser()` + `throw`, o mesmo caminho da
  rejeição por zod; `Callback` já mostra o estado de erro.
- Testes unitários: token adulterado (assinatura), `iss` errado, `aud` errado, expirado, e o
  caminho feliz. O mock de `UserManager` em `userManager.test.ts` precisa ganhar
  `metadataService.getKeysEndpoint`.
- ADR: verificação do `id_token` com `jose` (I4 cumprido; emenda ao plano §7.1), referenciando
  `nova_api/docs/integracao-rp.md` §7.

### b) Informações importantes

- **Testabilidade.** Deixar `getKey` injetável (parâmetro com default = JWKSet remoto). Nos
  testes, gerar par de chaves com `generateKeyPair("RS256")`, assinar com `SignJWT` e passar
  `createLocalJWKSet` — sem rede e sem mock de `fetch`. Conferir que o jsdom do Vitest expõe
  `globalThis.crypto.subtle` (o `nonce` já usa `crypto.randomUUID()` nos testes; `subtle` é
  outra API).
- **Ordem dos eventos.** `userLoaded` dispara dentro de `signinRedirectCallback()`, antes da
  verificação; `AuthProvider.toState` vira `authenticated` por instantes. É o mesmo cenário já
  aceito para a rejeição por zod (ADR 0007: em `/callback` só `Callback` está montada;
  `removeUser()` emite `userUnloaded` → `anonymous`). Não é regressão; registrar na ADR.
- **`issuer` por igualdade exata.** `VITE_OIDC_ISSUER` com barra final passa a falhar: o
  discovery tolera, o `iss` do token não. O comentário do `.env.example` já diz "sem barra
  final"; o item 4 da verificação manual (contrato §7) prova isso.
- **`clockTolerance`.** Poucos segundos (ex.: 30 s). A lib tem `clockSkewInSeconds` (300 s),
  mas não o aplica a `exp`; não reaproveitar.
- **Uma requisição a mais por login.** `createRemoteJWKSet` busca o JWKS; é cross-origin, então
  no IdP real depende do CORS em `jwks_uri` (contrato §2.1). No fake, o CORS ecoa qualquer
  origem; a chave muda a cada boot do fake, mas o módulo renasce a cada carregamento de página,
  logo o cache do JWKSet nunca fica velho.
- **Contexto seguro.** `crypto.subtle` só existe em `https` ou `localhost`: servir a SPA por
  `http://<ip-da-lan>` quebra a verificação. Anotar no README ou na ADR.
- O payload verificado pelo `jose` é o mesmo token que a lib decodifica em `user.profile`; o
  `safeParse` pode continuar lendo `user.profile`. Não duplicar parsing.
- `nonce` e `sub` continuam com a biblioteca (já cobertos); não reimplementar.
- Os e2e T-03 e T-05 seguem no fake e passam a exercitar a verificação de verdade (assinatura
  RS256 do `oidc-provider`).

---

## Passo 3 — Tolerar o IdP real e fechar "sessão no reload"

Fecha: contrato §5.4 e §5.5; checklist "Código" (`Landing`, `requestTimeoutInSeconds`, `name`
vazio) e "Registro" (ADR de sessão no reload).

### a) Itens

- `Landing`: distinguir `loading` de `anonymous`. Hoje `status !== "authenticated"` mostra
  "Entrar"; em `loading`, renderizar nada ou um placeholder.
- `requestTimeoutInSeconds` no `UserManager` (ex.: 10 s). Faz `signinRedirect` (busca do
  discovery) rejeitar em tempo finito, e `Landing`/`RequireAuth` mostram "Não foi possível
  iniciar o login" (item 7 da verificação, contrato §7).
- `Area.ClaimsList`: UX para `name === ""` (texto como "sem nome" no `<dd>`); schema intocado.
  Ajustar `Area.test.tsx` se houver caso de `name` vazio.
- ADR: sessão no reload por redirect + SSO (fecha plano §7.2), referenciando a ADR do IdP sobre
  `skip_authorization`. Sem código: `restoreSession()` continua `getUser()` em memória.

### b) Informações importantes

- Três mudanças de uma linha cada, independentes entre si, agrupadas porque todas só ficam
  visíveis contra o IdP real (latência, consentimento, contas sem nome).
- `loading` hoje dura uma microtask (`getUser()` em memória); o flash é curto, mas o
  `decisions.md` (TASK-003) o marca como restrição de desenho para qualquer `restoreSession`
  futura com rede. Distinguir agora fixa o contrato do estado.
- `requestTimeoutInSeconds` vale para todas as chamadas da lib (discovery, token). Um timeout
  curto demais no `/o/token/` contra a AWS derruba logins válidos; escolher com folga.
- 429 do limitador: nenhuma ação — cai no erro genérico. **Não** retentar (contrato §5.5).
- Consentimento: nenhuma mudança de código; o fluxo já é redirect top-level e funciona com ou
  sem a tela. A ADR de sessão no reload deve dizer que a ausência de consentimento a cada F5
  depende de `skip_authorization` no IdP.
- Razão de não usar `sessionStorage`/refresh, para a ADR: o `refresh_token` do IdP não expira
  nem é revogado ao desativar a conta (contrato §5.4).

---

## Passo 4 — Artefatos de deploy

Fecha: contrato §5.2 e parte do §6.2; checklist "Código" (`vercel.json`), "Produção" (CI) e
"Registro" (ADRs de deploy e do issuer).

### a) Itens

- `vercel.json` na raiz: rewrite universal para `/index.html`; headers `Referrer-Policy:
  no-referrer` e `X-Content-Type-Options: nosniff` (conteúdo literal no contrato §5.2).
- Workflow de CI (`.github/workflows/ci.yml`): `npm ci`, `typecheck`, `lint`, `test` (Vitest)
  em push e PR. e2e (Playwright) opcional — pesa (instala Chromium) e o contrato só exige os
  três.
- README: variáveis por ambiente no painel da Vercel; Node 22 fixado no projeto Vercel;
  contexto seguro para `crypto.subtle`.
- ADR: deploy na Vercel (`vercel.json`, variáveis por ambiente, previews sem IdP de produção,
  sem regex `*.vercel.app`), referenciando a ADR do IdP sobre CORS por origem exata.
- ADR: `VITE_OIDC_ISSUER` de produção fixado em `https://<dominio-do-idp>/o`, referenciando a
  ADR 0007 do IdP.

### b) Informações importantes

- Sem o rewrite, `/callback` responde 404 na Vercel e o `code` (60 s) morre. Hash router não é
  alternativa: a RFC 6749 §3.1.2 proíbe fragmento na `redirect_uri`.
- Os gates "deploy só depois do CI verde" e "produção só da `main`" **não** se configuram no
  repositório: são configuração do projeto Vercel (Git integration, branch de produção) e/ou
  branch protection no GitHub. O workflow dá o sinal; o gate é ligado no painel. Registrar na
  ADR de deploy como configuração externa.
- Node 22: a Vercel não lê `.nvmrc`, e `engines >=22.13` permite build em Node 24, que nenhum
  teste exercitou. Fixar no painel (ou apertar `engines`) — decidir na hora da configuração.
- O domínio do IdP ainda é `<dominio-do-idp>`. A ADR do issuer fixa a **forma** (`https://…/o`,
  sem barra final) e deixa o host para quando o IdP entregar.
- Preview sem variáveis: a build falha em `config.ts`, o que é desejável. Só criar cliente de
  preview no IdP se houver alias estável.

---

## Passo 5 — Integração em desenvolvimento contra o IdP real

Fecha: contrato §6.1 e §7 (itens 1–7); checklist "Desenvolvimento" inteira.

### a) Itens

- Entregar ao IdP: origem `http://localhost:5173` e `redirect_uri`
  `http://localhost:5173/callback`; receber o `client_id` de dev.
- `.env.local` apontando para `http://localhost:8000/o` com esse `client_id` (não versionado).
- Verificação manual dos 7 itens do §7 do contrato; registrar o resultado (checklist §9 do
  contrato e/ou `.claude/memory/decisions.md`).
- Confirmar que `npm run test:e2e` no fake continua verde (fake intocado).

### b) Informações importantes

- Pré-requisitos do lado do IdP, que bloqueiam este passo: CORS com a origem da SPA;
  `Application` pública com PKCE e o `redirect_uri`; `skip_authorization=True`; uma conta de
  teste sem nome.
- `e2e/idp.ts` está acoplado ao fake (`input[name=login]`, "Sign-in", "Continue"); o formulário
  real é `username`/`password` do `LoginView` do Django, seguido de `authorize.html` quando há
  consentimento. **Não** escrever um segundo helper agora: o contrato aceita verificação
  manual. Se um dia for automatizar, é tarefa `test-gap` separada.
- O item 4 (token adulterado / barra final) prova o passo 2; o item 7 (IdP derrubado) prova o
  timeout do passo 3.
- Pendências do `decisions.md` que só o IdP real responde — aproveitar a sessão para conferir:
  preflight de `/o/userinfo/` com `authorization` em `Allow-Headers`; 401 saindo com cabeçalho
  CORS; ramo "segundo 401 → falha sem redirect" (TASK-005).
- O `.env.example` fica no fake, e `playwright.config.ts` injeta as variáveis literais do fake
  por `env` (`process.env` vence `.env*` no Vite); o `.env.local` apontando para o real não
  afeta os e2e.

---

## Passo 6 — Produção na Vercel

Fecha: contrato §6.2 e §7 (produção); checklist "Produção" restante.

### a) Itens

- Entregar ao IdP: `https://<spa>` e `https://<spa>/callback` (mais o alias de preview, se
  houver); receber `client_id` de produção e o issuer.
- Painel da Vercel: variáveis por ambiente (Production ≠ Preview ≠ Development), Node 22,
  branch de produção = `main`, gate de CI.
- Verificações: `https://<spa>/callback` carregado diretamente responde a SPA, não 404; login em
  produção chega a `/app` com claims do `id_token` e do `userinfo`; bfcache conferido na origem
  publicada (a ADR 0010 foi verificada com bfcache forçado).

### b) Informações importantes

- Depende do IdP publicado na AWS com CORS e `Application` de produção. Nada de código neste
  passo, salvo correção do que a verificação apontar.
- Nunca commitar `.env.production` (I6): os previews o carregariam.
- bfcache: DevTools → Application → Back/forward cache. `Referrer-Policy: no-referrer` não afeta
  elegibilidade; `Cache-Control: no-store` na resposta da Vercel afetaria — conferir os headers
  reais da origem publicada.

---

## Resumo

| Passo | Fecha na checklist §9 | Depende de |
| --- | --- | --- |
| 1. Emenda a D2 e coerência do plano | Código: `VITE_IDP_ACCOUNT_URL`, plano emendado · Registro: ADR emenda a D2 | nada |
| 2. `id_token` com `jose` | Código: `jose` integrado · Registro: ADR I4 | passo 1 (testes de config limpos) |
| 3. Tolerar o IdP real + sessão no reload | Código: `Landing`, `requestTimeoutInSeconds`, `name` vazio · Registro: ADR sessão no reload | nada (pode correr em paralelo com o 2) |
| 4. Artefatos de deploy | Código: `vercel.json` · Produção: CI · Registro: ADRs de deploy e do issuer | nada |
| 5. Integração em dev contra o real | Desenvolvimento: todos | passos 2 e 3; IdP com CORS, `Application`, `skip_authorization` |
| 6. Produção na Vercel | Produção: restante | passos 4 e 5; IdP na AWS |

Os passos 1 a 4 são executáveis hoje, contra o fake. Os passos 5 e 6 esperam o IdP cumprir o
`contrato-backend.md`.
