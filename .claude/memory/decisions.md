# Registro de Decisões (tech-debt e decisões sem ADR)

> Log de decisões tomadas durante as tarefas e de melhorias/tech-debt identificados pelo
> `senso-critico`. **Quem escreve aqui é o orquestrador** (o thread principal); nenhum
> subagente grava neste arquivo.
>
> Decisões arquiteturais formais vão em `docs/adr/NNNN-slug.md` — **aqui fica só o resumo
> rastreável** e os itens que não bloquearam.
>
> **Formato de entrada:**
>
> ```
> ## [AAAA-MM-DD] TASK-NNN · {título}
> - **Decisão:** o que foi decidido e por quê.
> - **ADR:** docs/adr/NNNN-slug.md (se houver).
> - **Tech-debt / melhorias:** apontamentos que não bloquearam, com a disposição dada.
> - **Tipo:** decisão | melhoria | observação.
> ```

---

## Índice de decisões formalizadas em ADR

| Data | Decisão | ADR |
| --- | --- | --- |
| 2026-09-14 | Fixar npm e Node 22 LTS como base de ferramentas | docs/adr/0001-fixar-npm-e-node-22-como-base-de-ferramentas.md |
| 2026-09-14 | Adotar Tailwind CSS v4 pelo plugin oficial do Vite | docs/adr/0002-adotar-tailwind-v4-pelo-plugin-do-vite.md |
| 2026-09-14 | Usar React Router v7 como biblioteca, em modo data router | docs/adr/0003-usar-react-router-v7-como-biblioteca-em-modo-data-router.md |
| 2026-09-15 | Rodar o IdP fake local com `oidc-provider` em JavaScript ESM, montado em `/o` | docs/adr/0004-rodar-idp-fake-local-com-oidc-provider-em-javascript.md |
| 2026-09-15 | Validar as variáveis `VITE_*` no boot em `src/config.ts`, sem zod | docs/adr/0005-validar-variaveis-de-ambiente-no-boot-em-config-ts.md |
| 2026-09-15 | Integrar o `oidc-client-ts` v3 por um `UserManager` único, com tokens em memória e estado de redirect em `sessionStorage` | docs/adr/0006-integrar-oidc-client-ts-com-tokens-em-memoria.md |
| 2026-09-15 | Validar as claims do `id_token` com zod em dois portões e expor ao contexto só claims validadas | docs/adr/0007-validar-claims-do-id-token-com-zod-e-expor-so-claims-validadas-no-contexto.md |
| 2026-09-16 | Anexar o Bearer e converter 401 em re-auth num wrapper GET-only em `src/api/http.ts`, com requisição pendente e guarda de uma re-auth por aba | docs/adr/0008-anexar-bearer-e-converter-401-em-re-auth-num-wrapper-get-em-api-http.md |
| 2026-09-16 | Consumir o `userinfo` com TanStack Query v5, chaveado pelo `sub` do `id_token` e validado pelo schema de claims | docs/adr/0009-consumir-o-userinfo-com-tanstack-query-chaveado-pelo-sub-e-validado-pelo-schema-de-claims.md |
| 2026-09-16 | Sair localmente com `removeUser()` e disparar a guarda de rota só na entrada sem sessão, nunca na perda de sessão com a guarda montada | docs/adr/0010-sair-localmente-com-removeuser-e-disparar-a-guarda-so-na-entrada-sem-sessao.md |
| 2026-09-16 | Levar o destino do deep-link no `state` do `signinRedirect` e aceitar no callback só caminho da própria origem, resolvido por `URL` | docs/adr/0011-levar-o-destino-do-deep-link-no-state-do-signinredirect-e-aceitar-so-caminho-da-propria-origem.md |
| 2026-09-16 | Retirar as páginas de conta do escopo da SPA e remover `VITE_IDP_ACCOUNT_URL` (emenda a D2) | docs/adr/0012-retirar-as-paginas-de-conta-do-escopo-e-remover-vite-idp-account-url.md |
| 2026-09-16 | Verificar o `id_token` com `jose` em `completeSignin()` — assinatura via `jwks_uri`, `iss` exato, `aud`, RS256 e `exp` — e dar I4 por cumprido | docs/adr/0013-verificar-o-id-token-com-jose-em-completesignin-e-fechar-i4.md |
| 2026-09-16 | Manter a sessão no reload por redirect ao IdP e SSO, sem token fora da memória, e fechar o plano §7.2 | docs/adr/0014-manter-a-sessao-no-reload-por-redirect-e-sso-do-idp-sem-token-fora-da-memoria.md |
| 2026-09-17 | Fixar `requestTimeoutInSeconds` em 15 s no `UserManager` | docs/adr/0015-fixar-requesttimeoutinseconds-em-15-s-no-usermanager.md |
| 2026-09-17 | Publicar a SPA na Vercel com `vercel.json`, variáveis por ambiente no painel e previews sem IdP de produção | docs/adr/0016-publicar-na-vercel-com-vercel-json-variaveis-por-ambiente-e-previews-sem-idp-de-producao.md |
| 2026-09-17 | Fixar `VITE_OIDC_ISSUER` de produção na forma `https://<dominio-do-idp>/o`, sem barra final | docs/adr/0017-fixar-vite-oidc-issuer-de-producao-em-https-dominio-do-idp-barra-o-sem-barra-final.md |
| 2026-09-29 | Aceitar o IdP de produção servido pelo Cloudflare Tunnel com o contrato inalterado (proposta em 2026-09-24; contraparte da ADR 0027 do IdP, aceita em 2026-09-28) | docs/adr/0018-aceitar-o-idp-de-producao-servido-pelo-cloudflare-tunnel-com-o-contrato-inalterado.md |
| 2026-09-29 | Sair por logout iniciado pela RP com `signoutRedirect()` sem `state` (substitui a 0010; emenda a cláusula de logout da 0004; contraparte da ADR 0029 do IdP) | docs/adr/0019-sair-por-logout-iniciado-pela-rp-com-signoutredirect-sem-state.md |
| 2026-10-06 | Abrir as telas de conta sobre a API de conta, com as páginas de senha no IdP (substitui a 0012; contraparte da ADR 0031 do IdP; **Proposto**, aceite conjunto pendente) | docs/adr/0020-abrir-as-telas-de-conta-sobre-a-api-de-conta-com-as-paginas-de-senha-no-idp.md |

---

## Entradas sem ADR

## [2026-09-15] TASK-001 · Scaffold da SPA (etapa 1 do §8)
- **Decisão:** fundação Vite 8 + React 19 + TS 6 strict + ESLint 10 (flat) + Prettier + Tailwind 4 + react-router 7 (data router), scripts `dev/build/preview/typecheck/lint/format/format:check`; `engines.node >=22.13` (piso do eslint@10, acima da ADR 0001 que diz 22.12 — sem contradição: 22 LTS continua a decisão). Rotas `/callback` e `/app`, `.env*`, `config.ts` e deps de auth ficaram para as etapas 2–3 de propósito (I8: rota protegida não nasce sem guarda).
- **ADR:** 0001, 0002, 0003 (índice acima).
- **Tech-debt / melhorias:**
  - Adiado p/ etapa 2: `git init` antes de `.env.example` aparecer (I6 só vale com git). IdP fake em TS rodado por `node` direto falha em Node 22.12–22.17 e não passa por `tsc -b` (`tsconfig.node.json` só inclui `vite.config.ts`) — architect do fake decide `.js` ou `tsx`.
  - Adiado p/ etapa 3: (a) preset `react-hooks` v7 traz regras do React Compiler como `error` (`set-state-in-effect`) e colide com `useEffect` de boot/callback — decidir rebaixar regra ou adaptar padrão; (b) `react-refresh/only-export-components` inviabiliza `AuthProvider.tsx` exportando contexto+hook+componente — separar em `AuthContext.ts` + `useAuth.ts`; (c) `<StrictMode>` executa `signinCallback()` 2x em dev e gera falso erro no callback — NÃO corrigir tirando StrictMode nem relaxando `state` (I2); (d) `pages/App.tsx` colide em nome com o `App.tsx` convencional — considerar `pages/Area.tsx`.
  - Adiado p/ etapa 4: regras type-checked do typescript-eslint.
  - Adiado p/ etapa 7: script `test` (Vitest); Fase 4 do `/scaffold` esperava comando de teste rodando, mas runner sem teste é dependência sem uso.
  - Adiado p/ etapa 8: `vercel.json` com rewrite p/ `index.html` (sem ele `/callback` dá 404); Vercel não lê `.nvmrc` e `engines >=22.13` permite build em Node 24 — fixar versão na Vercel.
  - Tech-debt aceito: ADRs gravam versões literais (`>=22.12`, "Vite 7", "v7"); bump de major exigirá ADR substituta, não edição. ADR 0001 já cita Vite 7 com Vite 8 instalado (Contexto, não Decisão). react-router 8.x existe; ficou 7.18.3 por ADR 0003.
  - Rejeitado: `className` duplicado em Landing/NotFound (layout compartilhado só com a 3ª página).
  - Incidente: `prettier --write .` do writer reformatou 19 arquivos fora do escopo (CLAUDE.md, docs/*.md, .claude/**); restaurados e auditados (`auditar-sistema` LIBERADO). `.prettierignore` agora cobre `.claude`, `CLAUDE.md`, `docs/**/*.md`. Regra derivada: writer não roda `prettier --write .` sem ignore conferido.
  - Observação da auditoria: `.claude/skills/estilo-de-prosa/SKILL.md:37` cita `docs/esboco.md` inexistente (texto ilustrativo).
- **Tipo:** decisão.

---

**Regra ao acrescentar:** se a decisão tem ADR, escreva **uma linha** no índice e o resto
no ADR. Se não tem, escreva a entrada completa aqui. Um log que cresce sem poda não é
memória — é sedimento.

## [2026-09-15] TASK-002 · IdP fake + `.env.example` + `src/config.ts` (etapa 2 do §8)
- **Decisão:** fake em `dev/idp-fake/server.js` (JS ESM, `oidc-provider` 9 + `express` 5 como devDeps do root, `npm run idp`), espelhando só o contrato consumido pela SPA (client público `spa-local`, PKCE S256, claims `sub/name/email` no `id_token`, sem `end_session_endpoint`, CORS por client p/ 5173, rotas default ≠ do IdP real). `config.ts` é o único leitor de `import.meta.env`, sem zod e sem default; `throw` no topo do módulo. `strictPort` no Vite. `sub` = login digitado (`fake-user-1`). Plano §4/§5 (zod em `config.ts`) e §6 (`sub` fixo) ficam desatualizados de propósito — ADRs 0004/0005 registram.
- **ADR:** 0004, 0005 (índice acima).
- **Tech-debt / melhorias:**
  - Fechado: tech-debt da TASK-001 sobre fake em TS (decidido `.js` ESM fora do `tsc -b`, lint Node básico).
  - Adiado p/ etapa 3 / §7.2 (**ressalva do senso-critico**, agora nas Negativas da ADR 0004): fake é *same-site* com a SPA; cookie do IdP viaja em dev e não em prod. `restoreSession` NÃO pode ser desenhado assumindo `signinSilent`/iframe `prompt=none` funciona só porque passa no fake. Também: fake rotaciona refresh token p/ client público (real não) — `StrictMode` + `signinSilent` concorrente pode dar logout fantasma só em dev.
  - Adiado p/ etapa 4: (a) barra final em `VITE_OIDC_ISSUER` só quebra quando `jose` comparar `iss` com `config.oidc.issuer`, não no discovery; (b) fake nunca emite claim vazia, o `monolito-idp` pode (`name`/`email` `""`) — schema zod das claims não pode ser escrito olhando o fake; e2e da etapa 7 só conhece "Usuária de Teste".
  - Adiado p/ etapa 7: demandas de teste do QA — T-01/T-02/T-03 (unitário: `config.ts` lança nomeando cada `VITE_*` ausente/vazia; `requiredUrl` vs `required`; scope e valores expostos) e T-04 (integração: discovery/jwks do fake batem com o contrato). `preview.port` não está fixado (`strictPort` só cobre `vite`); Playwright sobre `vite preview` (4173) vai colidir com `redirect_uri` 5173.
  - Adiado p/ etapa 8 / §7.3: `VITE_IDP_ACCOUNT_URL` obrigatória força placeholder na Vercel enquanto os caminhos de conta não existem.
  - Adiado p/ etapa 9 (confirmar no back-end): CORS do `monolito-idp` precisa liberar também discovery e `jwks_uri` (o fake ecoa qualquer `Origin` nesses dois, então dev não detecta); scopes `profile`/`email` são premissa do plano, não contrato confirmado.
  - Observações sem ação: discovery do fake anuncia `implicit`/`id_token` nos `*_supported` (defaults do provider, sem efeito no client); máquina local roda Node 23 (não-LTS) e `oidc-provider` avisa "Unsupported runtime" — alvo continua Node 22 (`.nvmrc`); `engines >=22.13` × ADR 0001 (22.12) já registrado na TASK-001.
  - Rejeitado: editar plano §4/§5 (zod) — divergência já reconhecida na ADR 0005 e o plano é histórico; usuário vetou tocá-lo no gate.
- **Tipo:** decisão

## [2026-09-15] TASK-003 · Auth: `userManager`, `AuthProvider`, `/callback`, `RequireAuth` (etapa 3 do §8)
- **Decisão:** `oidc-client-ts` 3.5.0 confinado a `src/auth/userManager.ts` (`userStore` em `InMemoryWebStorage`, `stateStore` default em `sessionStorage` só durante o redirect, `automaticSilentRenew/monitorSession/loadUserInfo: false`); `signin()`/`completeSignin()` memoizados em escopo de módulo (dedup do StrictMode, sem relaxar `state`); `signin()` passa `nonce: crypto.randomUUID()` (W-01 do QA: a lib NÃO gera nonce no code flow). `AuthContext.ts` (tipos + `useAuth`) separado de `AuthProvider.tsx` (só componente; `setState` só em callbacks assíncronos → sem `eslint-disable`). `RequireAuth` como wrapper com children; `/app` = `pages/Area.tsx`. `restoreSession()` = `getUser()` em memória (reload → IdP; §7.2 segue aberto). Fecha os itens (a)–(d) adiados da TASK-001. Verificado ponta a ponta em Chrome headless (Playwright no scratchpad, fora do repo): AC-01..AC-10 conformes; `nonce` da URL de autorização confere com o `id_token`.
- **ADR:** 0006 (índice acima), aceita sem alteração por decisão do usuário; a restrição abaixo sobre "dois escritores de estado" fica só aqui.
- **Fases puladas:** 7 (tester) e 8 (QA 2ª passagem) — plano §8 coloca testes na etapa 7; sem Vitest/Playwright no projeto. Anunciado e aceito pelo usuário.
- **Fato verificado (muda o enquadramento do §7.1):** em `oidc-client-ts` 3.5.0, `_validateIdTokenAttributes` valida apenas `sub` e `nonce` (este só se enviado). NÃO valida `iss`, `aud`, `exp` nem assinatura. O plano §7.1 (linhas ~140-141) afirma o contrário — arquivo vetado nesta task; corrigir quando §7.1 for decidido. A etapa 4 (`jose`/zod) deve cobrir assinatura **e** `iss`/`aud`/`exp`, não só assinatura.
- **Tech-debt / melhorias:**
  - Adiado p/ §7.2 (**restrição de desenho**, ressalva do senso-critico): `AuthProvider` chama `restoreSession()` em todo boot, inclusive em `/callback`, e seu `.then(setState)` concorre com `userLoaded`. Seguro hoje só porque `getUser()` resolve em microtask. Qualquer `restoreSession` com rede (silent redirect, iframe, refresh) precisa: ou saber a rota (tensão com ADR 0003), ou não vencer `userLoaded`, ou `Landing` distinguir `loading` (hoje trata `loading` como `anonymous` e mostra "Entrar"). Soma-se à ressalva same-site da TASK-002.
  - Adiado p/ etapa 6 (ressalva do senso-critico, "caminho morto"): *Voltar* do IdP via bfcache quando a origem era `/app` → `pageshow` resolve `signinRedirect`, `redirecting` zera, mas `status` continua `anonymous` e `RequireAuth` não re-dispara → tela em branco até F5. Também etapa 6: `clearStaleState()` no boot p/ chaves `oidc.<id>` órfãs de login abandonado; estado de erro para `signin()` com IdP fora (hoje só console); mensagens por tipo de erro no callback (`access_denied` já cai no estado genérico).
  - Adiado p/ etapa 5/6: `getUser()` não olha `expires_at` — sessão em memória com token expirado continua `authenticated`; nada assina `accessTokenExpired`. Etapa 5 cobre `userinfo` (401 → re-auth); a guarda de rota (I8 "token válido") ainda não.
  - Adiado p/ etapa 4: I7 não honrado nas claims — `Area` lê `user.profile.{sub,name,email}` tipados como opcionais pela lib, sem validação runtime; etapa 4 decide se o contexto passa a expor só claims validadas (hoje o tipo `User` da lib vaza p/ as páginas).
  - Adiado p/ etapa 7: demandas de teste do QA — T-01 `signin()` dedup (unit); T-02 `completeSignin()` memo + rejeição compartilhada (unit); T-03 `RequireAuth` por status (unit); T-04 `Callback` falha/sucesso, `navigate` 1x sob StrictMode (unit); T-05 `Landing` (unit); T-06 `AuthProvider` restore/userLoaded (unit); T-07 `userManager.settings` (I3/I2/I5) (unit); T-08 e2e Playwright contra o fake: AC-01/02/07/08, AC-03, AC-06; T-09 `signin()` passa nonce não vazio e distinto (unit). Sem teste p/ `Area`, `useAuth`, `NotFound`.
  - Observações sem ação: AC-04 — reload manda ao IdP e ele devolve sem prompt por cookie de sessão próprio em navegação top-level (SSO do IdP, não silent auth da SPA; vale também cross-site com `SameSite=Lax`); interpretação: conforme. `iss` (RFC 9207) e `code_challenge_methods_supported` são ignorados pela lib — sem diferença fake × DOT. HMR em `userManager.ts` recria o store (perde sessão) — igual ao reload, dev-only. Classes de `<main>` repetidas 4x — ok no sandbox. 404 de `favicon.ico` pré-existente. Nenhuma `eslint-disable` foi necessária (item (a) da TASK-001 fechado só com padrão de código).
  - Risco estrutural (architect): memoização em escopo de módulo só é correta porque cada login é um carregamento de página novo; se o fluxo virar popup/iframe, vira bug silencioso.
- **Tipo:** decisão

## [2026-09-15] TASK-004 · Validação de borda das claims com zod (etapa 4 do §8)
- **Decisão:** contrato de claims em `src/auth/claims.ts` — `sub` e `email` string não vazia (`email` é o identificador de login no IdP), `name` string **podendo ser `""`** (`get_full_name()`), extras descartadas (`z.object`, sem `strictObject`/`trim`/`.email()`). Aplicado em dois portões: `AuthProvider.toState()` (handler de `userLoaded` + `restoreSession`) e `completeSignin()` (rejeição → `removeUser()` + `throw ZodError`). Contexto expõe `claims: Claims`, não `User`. **§7.1 (jose/JWKS) permanece em aberto por decisão do usuário**; I4 segue pendente (ver fato verificado na TASK-003: a lib não valida `iss`/`aud`/`exp`). Fake ganhou logins `sem-name`, `sem-email`, `name-numero` (falham) e `name-vazio` (entra). Infra de teste antecipada da etapa 7 por autorização do usuário: Vitest 5 (`test` em `vite.config.ts`, jsdom por pragma), T-01..T-03 = 19 casos; T-04 (Playwright e2e) fica na etapa 7. Correção de rumo no meio da tarefa: "name não pode ser vazio" nasceu de mal-entendido (login ≠ claim) e foi revertido antes do fechamento; A1 do senso-critico (barrar usuário real sem nome) dissolvido por isso.
- **ADR:** 0007 (índice acima). Mecanismo da alternativa 1 corrigido antes de gravar (senso-critico A10): em `/callback` só `Callback` está montada; o risco real de validar tarde é estado `authenticated` preso sem ouvinte de `userUnloaded` + "Voltar ao início" → `Landing` → `/app`.
- **Tech-debt / melhorias:**
  - Adiado p/ etapa 6 (**restrição de desenho**, senso-critico A2): "Sair" vai ouvir `userUnloaded`, e `removeUser()` já é disparado na rejeição de claims. O handler de `userUnloaded` só atualiza estado; navegação fica no botão — senão a rejeição navega para `/`, desmonta `Callback` (`active=false`) e o erro some sem tela nem console.
  - Adiado p/ etapa 6 (senso-critico A4): `completeSignin()` devolve `Claims` e descarta `user.state` (deep-link do plano §2.6). Quando o deep-link entrar, reabrir a assinatura (ex.: `{ claims, returnTo }`) e T-03(b), que fixa o formato de retorno. Também etapa 6: `Area` renderiza `name` `""` em branco, sem fallback (writer) — decidir UX.
  - Adiado p/ §7.2 (**restrição de desenho**, senso-critico A3): a limpeza de tokens rejeitados existe só em `completeSignin()`. Toda entrada nova por `_buildUser` (`signinSilent`, popup, refresh com `id_token` novo) grava token e emite `userLoaded`; o portão 1 vira `anonymous` mas não remove. Ou §7.2 replica o `removeUser()`, ou o portão 1 passa a remover. A frase da ADR 0006 "só `restoreSession()` e o `userStore` a tocar em §7.2" deixou de valer.
  - Adiado p/ etapa 7 (senso-critico A5): a ordem `storeUser → userLoaded → resolve` está pinada só por leitura da 3.5.0 (`^3.5.0` no package.json); T-02/T-03 mockam a lib e não avisam. T-04 e2e deve afirmar "login válido chega a `/app` sem redirect extra" e "claims inválidas → erro sem passar por `/app`"; alternativa: pinar versão exata. Também etapa 7: T-01 exercita `auth_time`/`at_hash` como extras, mas a lib as filtra antes (`filterProtocolClaims`) — cosmético. `sub` vazio/ausente é rejeitado pela lib antes do zod (mesmo estado de erro); fake não emite — coberto só por T-01.
  - Adiado p/ etapa 9: confirmar no `monolito-idp` que `email` nunca é vazio para quem loga (login por email) — premissa do contrato; e que a chave `name` está sempre presente no `id_token` (mesmo vazia).
  - Aceito: schema roda 2× por login (função pura); `min(1)` sem `trim` (`"   "` passa); `console.error` no callback pode logar `ErrorResponse.form` com `code`/`code_verifier` já consumidos (material morto); `package-lock.json` alterado por instalar deps.
  - Rejeitado: editar plano §5 (contexto com `user` → `claims`) e §4/§5 (zod em `config.ts`) — plano é histórico, ADRs 0005/0007 registram. README citar os logins malformados — banner do fake basta no sandbox.
  - Incidentes: tester instalou `vitest@3` alegando ser a major atual (latest 5.0.1, peer `vite@8`) e criou `vitest.config.ts` + cópia duplicada de vite@7 para contornar; corrigido na mesma fase. `npm 11.0.0` falha (`edgesOut`) ao instalar; contornado com `--legacy-peer-deps` e `@testing-library/dom` declarado explicitamente. Fake antigo (PID de 16h) ocupava a 9000 e mascararia qualquer verificação manual — encerrado com autorização do usuário. QA 2ª passagem: T-03(a) passava por timing de microtask; mock diferido, mutação provada.
- **Tipo:** decisão

## [2026-09-16] TASK-005 · `api/http.ts` + TanStack Query em `userinfo` (etapa 5 do §8)
- **Decisão:** `src/api/http.ts` (`authGet` GET-only com Bearer lido de `getUser()` dentro do módulo; 401 → marcador `spa.reauth` em `sessionStorage` + `await signin()` com promessa pendente até o unload; segundo 401 na aba → `UnauthorizedError` sem redirect), `src/api/userinfo.ts` (`fetchUserinfo(expectedSub)`: endpoint via `metadataService.getUserInfoEndpoint()`, `claimsSchema.parse`, `sub` ≠ `id_token` rejeitado; `useUserinfo(sub)` com `queryKey: ["userinfo", sub]`), `src/api/queryClient.ts` (`retry` nunca para `UnauthorizedError`, 1× para o resto; `refetchOnWindowFocus`/`staleTime` padrão), `QueryClientProvider` fora de `AuthProvider`, `Area` com duas seções rotuladas (`id_token`, `userinfo`). Decisão de produto (PM): as duas fontes lado a lado — só o par torna observável que o Bearer funcionou. `@tanstack/react-query` 5.102.8. 17 testes novos (T-01..T-04; 36/36). `src/auth/*` e fake intocados.
- **ADR:** 0008, 0009 (índice acima), aceitas como vieram do architect.
- **Fato verificado (derruba o CRITICO do senso-critico):** no DOT 3.4.1, `UserInfoView` não passa por `ProtectedResourceMixin` (que devolveria 403); usa `OAuthLibMixin.create_userinfo_response` → `oauthlib` `UserInfoEndpoint` → `InvalidTokenError` com `status_code = 401` e `WWW-Authenticate`. O `monolito-idp` (`~/diretorio/nova_api`) usa a view stock (`config/urls.py` inclui `oauth2_provider.urls`; `IdPOAuth2Validator` só sobrescreve `get_additional_claims`). Fake e real concordam no 401; a política da ADR 0008 vale em produção. Apontamento **rejeitado**.
- **Tech-debt / melhorias:**
  - Adiado p/ etapa 6 (**restrições de desenho**, senso-critico): (a) a promessa pendente só é "sem tela intermediária" para o refetch em foco (`cancelRefetch: false`); `refetch()` do observer e `invalidateQueries`/`refetchQueries` (`cancelRefetch: true`) cancelam a consulta presa em `signin()` e expõem "Não foi possível obter o userinfo." durante o unload — quem tocar o cache do `userinfo` usa `cancelRefetch: false`, `removeQueries` ou `clear`, nunca `invalidate`; (b) "Sair" chama `queryClient.clear()` ao esquecer tokens (o `AuthProvider` pode fazê-lo em `userUnloaded`, o provider de query está acima dele); (c) bfcache: "Voltar" do IdP após um 401 deixa `spa.reauth` gravado → refetch seguinte mostra falha até F5 — junta-se ao tech-debt de bfcache da TASK-003; mesma família: rejeição de rede em `fetch` (sem `Response`) não remove o marcador (QA); (d) `UnauthorizedError` sem `name` — no console sai "Error: …"; uma linha quando os estados de erro forem tratados (QA); (e) `Area.test.tsx` mocka `UnauthorizedError` com classe nova em vez de `importOriginal` — inerte hoje, cega se a produção passar a distinguir a classe nesse fluxo (QA 2ª).
  - Adiado p/ "primeiro consumidor adicional de `authGet`" (**restrição de desenho**, senso-critico): o marcador `spa.reauth` é global por aba e é limpo por qualquer não-401 de qualquer URL; um segundo recurso que recuse o token permanentemente enquanto o `userinfo` responde 2xx reabre o laço (um redirect por foco). Chavear o marcador por URL, ou só limpar no 2xx da mesma URL.
  - Adiado p/ §7.2 / etapa 6: tech-debt "`getUser()` ignora `expires_at`" (TASK-003) fica parcial — só detectado quando o `userinfo` é chamado; `RequireAuth` segue admitindo token expirado. Com o DOT (36000 s) e `refetchOnWindowFocus`, cada volta à aba após a expiração vai ao IdP; §7.2 com refresh estende `authGet` (checar `expires_at`/`signinSilent` antes do `fetch`) e o ramo 401 vira fallback — não é desfeito.
  - Adiado p/ etapa 7: AC-04 ponta a ponta (401 → redirect → `/callback` → `/app` com `userinfo`) e AC-09 manual não têm teste automatizado; Playwright. `http.test.ts` (c) usa timer real de 50 ms — único ponto da suíte com relógio; direção segura (QA 2ª).
  - Adiado p/ etapa 9: o ramo "segundo 401 → falha sem redirect" só é provável contra o IdP real (fake recria chave e store juntos); confirmar CORS do `monolito-idp` em `/o/userinfo/` (preflight com `authorization` em `Allow-Headers`, default do django-cors-headers; 401 sai com cabeçalho CORS — middleware aplica a qualquer status).
  - Observações sem ação: verificação manual de AC-04/05 exige **trocar de aba** (v5 escuta `visibilitychange`), não clicar na janela; ADR 0009 justifica o `sub` na `queryKey` com "troca de usuário na mesma vida da página", cenário impossível (ADR 0006; `verifySub` em `_buildUser`) — a razão válida é "identidade diferente nunca lê cache alheio por construção"; ADR aceita é imutável, fica registrado aqui. Fake não tem 401 sob demanda: reiniciar `npm run idp` invalida o token.
  - Rejeitado: anotar `useUserinfo` com `UseQueryResult<Claims>` (writer) — o tipo já é inferido de `Promise<Claims>`; anotar é ruído no sandbox. Teste isolado de `useUserinfo`/`queryKey` por `sub` (tester) — protege cenário inexistente por construção; `Area.test.tsx` cobre o hook. `context.json` modificado no working tree (writer) — é do orquestrador.
  - Incidente: QA 1ª passagem caiu por limite de sessão (429) antes de produzir relatório; relançado do zero no dia seguinte sem perda.
- **Tipo:** decisão

## [2026-09-16] TASK-006 · Sair, deep-link, estados de erro, `NotFound` (etapa 6 do §8)
- **Decisão:** "Sair" local: `signout()` em `src/auth/userManager.ts` (= `removeUser()`, sem rede); `AuthProvider` ouve `userUnloaded` e faz só `setState(anonymous)` + `queryClient.clear()`, nunca navega; botão em `Area` faz `await signout()` → `navigate("/")` (push) com aviso de que a sessão no IdP continua. `RequireAuth` dispara `signin()` **só na entrada sem sessão** (`useRef hadSession`): perda de sessão com a guarda montada renderiza `null`, quem provocou navega — resolve o `[CRITICO]` do PM (bounce ao IdP por SSO) sem `flushSync` nem estado intermediário. Deep-link: destino no `state` do `signinRedirect` (`signin(returnTo?)`), `completeSignin()` → `{ claims, returnTo }`, `returnTo` saneado por `internalPath` (`new URL(raw, origin)` + comparação de `origin`; rejeita `//host`, `/\host`, esquemas → `/app`); `Callback` navega com `replace`. Estados de erro sem nada novo no contexto: a promessa de `signin()` rejeita = IdP fora (`Landing` mostra `role="alert"` + retry; `RequireAuth` mostra fallback com "Entrar" e "Voltar ao início"), resolve = voltou por bfcache (`pageshow`) → "O login não foi concluído.". `NotFound` já atendia; inalterado. `http.ts`, `userinfo.ts`, `queryClient.ts`, `main.tsx`, `router.tsx` e fake intocados. 26 testes novos (T-01..T-08; 62/62). AC-01..AC-16 verificados no navegador pelo QA (Chromium 149; AC-11 com bfcache real forçado). Checklist §10 item 6 marcado.
- **ADR:** 0010, 0011 (índice acima), aceitas como vieram do architect.
- **Restrição de desenho para §7.2 (senso-critico + architect + writer + QA — aceito):** com a ADR 0010, I8 na prática é "só na entrada". **Toda transição `authenticated`→`anonymous` com a guarda montada precisa navegar ou emitir erro; a guarda não reage.** Vale para `removeUser()` por `accessTokenExpired`/`silentRenewError` **e** para o portão 1 de claims (`AuthProvider.toState` rejeitando um `id_token` renovado, que vira `anonymous` sem remover tokens). Sem isso `/app` fica em `null` silencioso. O comentário de `src/api/http.ts:15` ("assunto da guarda de rota") pressupõe a guarda antiga; `docs/spa-nucleo.md` I8 não foi estreitado no núcleo — quem fechar §7.2 decide se o invariante é reescrito.
- **Tech-debt / melhorias:**
  - Adiado p/ etapa 7 (senso-critico): a suíte prova botão e handler separadamente; o elo "`signout()` só resolve depois de `anonymous` + `clear()`" e "`signin()` resolve = bfcache" estão pinados por leitura da lib 3.5.0 (`Event.raise` faz `await cb()`; `RedirectNavigator` só resolve em `pageshow`). Junta-se ao item TASK-004 A5 (ordem pinada por leitura, `^3.5.0`). Teste barato com `UserManager` real + `InMemoryWebStorage` para `removeUser()`/`events.load()`.
  - Adiado p/ etapa 8 (senso-critico): AC-11 foi verificado com bfcache **forçado**; conferir elegibilidade do documento na origem publicada (DevTools > Application > Back/forward cache) — `Cache-Control: no-store` ou WebSocket tornam o Chromium inelegível e Voltar vira reload → IdP (comportamento pré-ADR, não tela em branco).
  - Adiado p/ etapa 9 (senso-critico): "não foi possível iniciar o login" pressupõe falha rápida; `requestTimeoutInSeconds` não está configurado no `UserManager`, então IdP adormecido no Render (cold start) pendura `signin()` sem feedback — `Landing` não tem estado "pendente" e o segundo clique devolve a mesma promessa memoizada. Com metadata já em cache no mesmo documento, `signinRedirect` nunca rejeita (vai à página de erro do navegador). Uma linha de timeout resolve; decidir na etapa 9.
  - Adiado p/ §7.2 / etapa 9 (QA): corrida improvável Sair × `userinfo` em voo — 401 chegando depois de `removeUser()` grava `spa.reauth` e chama `signin()`; `http.ts` proibido nesta tarefa.
  - Adiado p/ §7.3 (PM): "Registrar-se" (landing) e "Editar perfil" (`/app`) previstos em §2.1/§2.3 sem etapa no §8; `VITE_IDP_ACCOUNT_URL` validada em `config.ts` sem uso. Precisa de dono e etapa.
  - Adiado, item próprio (PM): `Area` renderiza `name` `""` como campo em branco; sugerido marcador visível ("—"). Fora dos quatro itens da etapa 6.
  - Fechados sem código: TASK-003 "`clearStaleState()` no boot" — a lib chama em todo `createSigninRequest`; TASK-003 "estado de erro para `signin()` com IdP fora" — feito (AC-09/10); TASK-003 "bfcache tela em branco" — feito (AC-11); TASK-004 A4 (`user.state` descartado / T-03(b)) — feito (ADR 0011, T-01); TASK-005 (b) `queryClient.clear()` em `userUnloaded` — feito (T-04); TASK-005 (c) marcador `spa.reauth` preso após 401 + Voltar — **aceito como está**: com `hadSession` a guarda não redireciona, `/app` mostra "Não foi possível obter o userinfo." com refetch em foco, e "Sair" é a ação de saída; o marcador preso é o que impede o reenvio automático (AC-11). TASK-003 "mensagens por tipo de erro no callback" — fora por decisão do PM (§2.2 pede uma mensagem).
  - Observações sem ação: fallback do `RequireAuth` sem `role="alert"` enquanto a `Landing` tem (QA) — mesma frase, página inteira troca; acrescentar se um teste precisar. Re-auth por 401 volta a `/app` sem query string (`http.ts` sem destino) — aceito, única rota protegida (ADR 0011). AC-06 só observável por query string com uma rota protegida (PM). Duplo clique em Sair → dois `push("/")`, cosmético.
  - Incidente: senso-critico caiu por limite de sessão (429) antes de produzir relatório; relançado do zero sem perda.
- **Tipo:** decisão

## [2026-09-16] TASK-007 · Testes: Vitest (config) + Playwright e2e contra o fake (etapa 7 do §8)
- **Decisão:** rota `/test-gap`; produção em `src/` byte a byte igual (só `*.test.*` novos). Vitest: `src/config.test.ts` (T-01, 14 casos: ausente/vazio/só-espaço/URL inválida por variável, `CLIENT_ID` sem exigência de URL; cada caso estuba as 4 `VITE_*` — imune ao `.env.local`) e `src/auth/userManager.lib.test.ts` (T-02, lib real sem mock nem rede: `await signout()` só resolve depois do handler assíncrono de `userUnloaded`; `storeUser` não dispara `userLoaded`) — fecha o débito TASK-004 A5 / TASK-006 "ordem pinada por leitura". Playwright 1.63 (Chromium 1243), 1 projeto, `retries: 0`, `webServer` duplo (`npm run idp` + `npm run dev` com as 4 `VITE_*` literais de `.env.example` via `env` — `process.env` vence `.env*` no Vite), `reuseExistingServer: !CI`. Cinco specs cobrindo só o que o redirect real prova: T-03 login completo (discovery, PKCE, `id_token` RS256, `userinfo` Bearer, I3 sem `oidc.*` em storage); T-04 deep-link `/app?x=1` com `/callback` fora do histórico; T-05 `sem-email` nunca chega a `/app` (por `framenavigated` + zero `/o/me`); T-06 Sair local + SSO sem `/o/interaction`, exatamente 2 `/o/auth` (prova também que `hadSession` não faz bounce); T-07 401 em `/o/me` via `page.route` só no 1º GET → SSO → `/app` com `userinfo`, marcador `spa.reauth` limpo — fecha AC-04 da TASK-005. Isolamento: Vitest `exclude: e2e/**` (bloco `test` do `vite.config.ts`; tripla-barra `vitest/config` removida porque o import de `configDefaults` a torna erro de lint `triple-slash-reference` — confirmado pelo QA como necessário); Playwright `testDir: e2e`, `testMatch: *.spec.ts`. Scripts `test:e2e` e `test:e2e:install`; README +2 linhas; `.gitignore` com artefatos do Playwright. Verificado: `npx vitest run` 78/78 (12 arquivos, era 62/10), `CI=1 npm run test:e2e` 5/5 com portas livres antes e depois, lint/typecheck/prettier verdes. Checklist §10 item 7 marcado.
- **Não coberto, por decisão do QA:** reload em `/app` → SSO (transitório até §7.2); `Landing` com sessão → `/app` (unidade cobre; sem caminho e2e sem reload); `NotFound`/glue sem decisão; discovery/JWKS do fake como teste próprio (T-03 já os exige); `name-vazio` ponta a ponta; IdP fora do ar em e2e; cross-browser (fluxo OIDC sem ramo por navegador); bfcache (etapa 8) e timeout (etapa 9).
- **Tech-debt / melhorias:**
  - Adiado p/ etapa 8 (QA, usuário decidiu): `e2e/**` e `playwright.config.ts` ficam fora do `tsc -b` (`tsconfig.app` só `src`, `tsconfig.node` só `vite.config.ts`); ESLint e Prettier os cobrem, typecheck não. Incluir em `tsconfig.node.json` quando o CI montar o typecheck.
  - Aceitos e aplicados na rodada de polimento (QA → tester): `claimsSection` movido para `e2e/idp.ts`; parâmetro `login` renomeado para `user`; comentário sobre a ordem load-bearing `toHaveCount(3)` → `allTextContents` em t03.
  - Observações sem ação: `.env.local` presente no working tree (T-01 e T-09 são imunes); `oidc-provider` avisa "Unsupported runtime" no Node 23.6 (pré-existente, TASK-002); `[console.error] ZodError` no log do vite durante t05 é o `console.error` esperado de `Callback.tsx`.
  - Incidente: processos `vite`/`idp-fake` de 14 h ocupando 5173/9000 (mesma situação da TASK-004) encerrados com autorização antes da Fase 2; a rodada de polimento reaproveitou dois servidores deixados vivos por execução anterior do pipeline — encerrados pelo orquestrador e suíte reexecutada com `CI=1` e portas livres. Regra prática: rodar a 2ª passagem sempre com `CI=1` para o `webServer` não reaproveitar nada.
- **Tipo:** decisão

## [2026-09-16] TASK-008 · Emenda a D2: sem páginas de conta, `VITE_IDP_ACCOUNT_URL` removida (passo 1 de `implementacao-contrato.md`)
- **Decisão:** rota `/refactor` (comportamento idêntico; ADR a registrar descartou `/chore`). Removida — não tornada opcional — de `src/config.ts`, `src/vite-env.d.ts`, `.env.example` (ganhou comentário de como apontar ao IdP real, `:8000/o`), `playwright.config.ts` e dos `fakeConfig`/listas de `config.test.ts`, `userManager.test.ts`, `userManager.lib.test.ts`. Plano: tabela do topo, §2 (rota `/` e itens 1 e 3 sem "Registrar-se"/"Editar perfil" + nota de emenda), §3, §4, §7.3 fechado (número mantido), §9; §7.1 reescrito só para corrigir a afirmação falsa sobre a lib (`oidc-client-ts` 3.5.0 valida só `sub` e `nonce`) — continua aberto; §7.2 intocado (passo 3). `CLAUDE.md`: D2 emendada e "Decisões em aberto" sem §7.3. Efeito no `nova_api`: nenhum além da ADR cruzada pendente lá ("sem páginas de conta nesta fase"), que pode citar a 0012 por número. Verificado: grep de `VITE_IDP_ACCOUNT_URL|idpAccountUrl` vazio em `src/`, `.env.example`, `playwright.config.ts`; `typecheck`/`lint`/`prettier` verdes; Vitest 75/75 em 12 arquivos (era 78 — os 3 casos da variável em `config.test.ts`, 14 → 11); `CI=1 npm run test:e2e` 5/5. Gate do `/refactor` atendido: testes mudaram só pela remoção. `senso-critico` não invocado (nenhuma fronteira entre componentes movida).
- **ADR:** 0012 (índice acima), aceita como veio do architect.
- **Tech-debt / melhorias:**
  - Fechados por esta tarefa: TASK-002 "Adiado p/ etapa 8 / §7.3" (placeholder na Vercel) e TASK-006 "Adiado p/ §7.3 (PM)" (links sem etapa, variável sem uso) — ADR 0012.
  - Aceito como está (architect, QA): `docs/spa-nucleo.md` §5/§6, parágrafo "Ainda não há código" do `CLAUDE.md` e ADRs 0004/0005 ficam com texto defasado — núcleo/ADRs são históricos e imutáveis; a ADR 0012 registra a defasagem nas Negativas.
  - Aceito (QA): §7.1 do plano reescrito além da emenda a D2 — estava na estrutura alvo autorizada na Fase 2; corrige fato falso sem decidir nada (decisão é do passo 2).
  - Adiado p/ passo 3 (architect, QA): item da checklist §9 do `contrato-frontend.md` sobre o plano (§7.2 "marcado como decidido") fica aberto; ao fechar §7.2, trocar também a referência órfã "mapa do back-end" em §7.2 (l.153) — arquivo apagado na tarefa anterior.
  - Aceito e aplicado com autorização posterior do usuário (writer, QA): `docs/contrato-frontend.md` §8 l.280 "opcional" → "removida (ADR 0012)"; checklist §9 marcados "`VITE_IDP_ACCOUNT_URL` removida…" e "ADR: emenda a D2…" (23 → 21 itens abertos).
  - Rejeitado (QA): corrigir "validadas com zod" no plano §4 — mesma disposição da TASK-002 (plano é histórico; ADR 0005 já assume a divergência).
- **Tipo:** decisão

## [2026-09-16] TASK-009 · Verificação do `id_token` com `jose` (passo 2 de `implementacao-contrato.md`; I4 cumprido)
- **Decisão:** rota `/feature` (SUBSTANTIVO → architect → writer → QA → tester → QA → senso-critico). `jose ^6.2.12` confinado em `src/auth/idToken.ts` (`verifyIdToken(idToken, getKey): Promise<void>` com `issuer` = config (igualdade exata), `audience` = `client_id`, `algorithms: ["RS256"]`, `requiredClaims: ["exp"]`, `clockTolerance: 60`; `remoteJwks(uri)` = `createRemoteJWKSet`). `completeSignin()` verifica antes do zod num `try/catch` unificado (`getKeysEndpoint(false)` dentro do bloco; `claimsSchema.parse`; `removeUser()` aguardado antes de relançar). Nenhum parâmetro em `completeSignin()`; `nonce`/`sub` seguem com a lib; `Callback`/`AuthProvider`/fake intocados. Testes: `idToken.test.ts` (node, chaves locais, 13 casos assertados por classe de `jose.errors`), `userManager.test.ts` (mock com `metadataService`, `vi.doMock("./idToken")`, caso (c2): erro de verificação sobe intacto, `removeUser` antes, zod não consultado), e2e T-03 afirma `req:/o/jwks` antes de `nav:/app`. Verificado: Vitest 13 arquivos / 89 testes (era 75), `CI=1 test:e2e` 5/5, `typecheck`/`lint`/`prettier` verdes, `dev/idp-fake/` byte a byte. Emendas: plano §7.1 fechado e tabela do topo (só §7.2 aberta), `CLAUDE.md` "Decisões em aberto", contrato §9 `[x]` "jose integrado" e "ADR I4". Efeito no `nova_api`: nenhum código; ver notas cruzadas abaixo.
- **ADR:** 0013 (índice acima). Corrigida antes do commit por achados do senso-critico (rotação de chave e CORS) e do QA (`safeParse` → "validação zod").
- **Tech-debt / melhorias:**
  - **Aceito (senso-critico, CRITICO) → tech-debt registrado na ADR 0013 (Negativas):** a SPA NÃO sobrevive à rotação da chave RSA do IdP dentro da janela de cache HTTP — o reload por `kid` do `createRemoteJWKSet` é inerte (instância nova por login + `cooldownDuration` 30 s) e o DOT serve o JWKS com `max-age=3600` + `stale-while-revalidate=3600`; após rotação, quem obteve o JWKS na hora anterior falha todo login por até 1–2 h com a mensagem genérica. Saídas a decidir em tarefa própria: (a) SPA: `fetch` próprio com `cache: "no-store"` via `customFetch` do `jose`; (b) IdP: runbook de rotação publicando a chave nova em `OIDC_RSA_PRIVATE_KEYS_INACTIVE` por ≥ `OIDC_JWKS_MAX_AGE_SECONDS` antes de ativá-la. **Nota cruzada para o `nova_api`** (regra da raiz): levar ao passo 5 / contrato-backend.
  - **Aceito (senso-critico) → ADR corrigida; nota cruzada:** CORS de descoberta e `jwks_uri` é `Access-Control-Allow-Origin: *` emitido pelo próprio DOT (`views/oidc.py`), não a allowlist — `contrato-backend.md` §5.2 l.185–187 descreve o mecanismo errado; corrigir lá quando o `nova_api` for tocado. Consequência: a OBSERVACAO do PM "CORS ausente em `jwks_uri`" → **rejeitada** (sem cenário).
  - Registrado (senso-critico): fake não envia `Cache-Control` no JWKS; e2e nunca exercita o comportamento com cache. Fake intocável (AC-12); se a saída (a) for escolhida, decidir como prová-la.
  - Aceito e aplicado (QA): ADR 0013 "safeParse" → "validação zod das claims" (código usa `parse` em try/catch, forma delegada pelo architect).
  - Aceito como está (PM CRITICO → architect): contexto seguro (`crypto.subtle`) não é restrição nova — ADR 0006 já a registra pelo PKCE; ADR 0013 repete. README no passo 4.
  - Aceito como está (PM, architect): janela transitória `authenticated` cresce de microtask a rede; só `Callback` montada em `/callback` (verificado pelo senso-critico: nada consome `userinfo` ali). Restrição TASK-006 continua para §7.2.
  - Adiado, tarefa própria (PM, architect): validar forma de `VITE_OIDC_ISSUER` (barra final) no boot em `config.ts` — hoje falha só no callback com mensagem genérica (AC-04 prova a rejeição).
  - Adiado p/ §7.2 (PM, architect): verificação cobre só `completeSignin()`; entradas futuras (`signinSilent`, refresh) precisam replicar `verifyIdToken` + `removeUser()` — soma-se a TASK-004 A3.
  - Aceito (architect): `requiredClaims: ["exp"]` além do literal do PM — coberto por T-01(c). AC-01 exige a asserção `/o/jwks` no T-03 — feita (T-10). Nenhuma ADR nova no `nova_api`: contraparte são as ADRs 0004/0007 do IdP e `integracao-rp.md` §7.
  - Registrado, sem ação: parágrafo "Contraparte" da ADR 0013 ainda diz "§5.2 (CORS em `jwks_uri`)" (leve incoerência com o Contexto corrigido). `at_hash` não verificado (fora de I4; code flow); ADRs 0006/0007 defasadas em "§7.1 aberto" (imutáveis); `removeUser()` rejeitando substitui o erro original (pré-existente); `jose` 6.2.12 compartilhado com o `oidc-provider` do fake hoje; `createRemoteJWKSet` novo por chamada (memoizado); parâmetro opcional morto em `mockOidcClientTs` e caso (b) sem sentinela para o 2º arg de `verifyIdToken` (e2e cobre); rótulo "(c2)" sem renumerar; item da checklist §9 "Plano §7.1 emendado…; §7.2 e §7.3" segue aberto até o passo 3.
  - Incidente: QA da 1ª passagem caiu por limite de sessão (429) logo após entregar o relatório completo; nada perdido.
- **Tipo:** decisão

## [2026-09-17] TASK-010 · Tolerar o IdP real e fechar "sessão no reload" (passo 3 de `implementacao-contrato.md`; plano §7.2 fechado)
- **Decisão:** rota `/feature` (SUBSTANTIVO → architect → writer → QA → tester → QA → senso-critico → architect/writer/tester para correções). Três mudanças de uma linha: `Landing` renderiza `null` em `loading` (contrato dos três estados de `AuthState` fixado: `loading` = ainda não se sabe, nenhuma página decide); `requestTimeoutInSeconds: 15` no `UserManager`; `Area.ClaimsList` mostra `(sem nome)` (`text-neutral-600`) só quando `name === ""` — apresentação, schema intocado. Sessão no reload = redirect + SSO, `restoreSession()` continua `getUser()` em memória; sem `sessionStorage`/refresh/`prompt=none`/BFF. Testes: `Landing.test.tsx` (+2, `MemoryRouter`+`Routes` com sentinela `/app`), `Area.test.tsx` (b atualizado, +f/g), `userManager.lib.test.ts` (+c: settings pinadas com a lib real + I3), `e2e/t08-timeout.spec.ts` (novo: descoberta e `/o/token` pendurados por `page.route`, 15 s cortados pela lib; mutação confirmada nos quatro T pelo QA). Verificado: Vitest 94/94 em 13 arquivos (era 89), e2e 7/7 (~21 s, era ~5 s), `typecheck`/`lint`/`prettier` verdes; fake e `e2e/idp.ts` intocados. Emendas: plano (tabela do topo sem "abertas"; §7.2 fechado), `CLAUDE.md` ("Decisões em aberto: nenhuma"; item sessão no reload), contrato §9 cinco `[x]` (Landing, timeout, name vazio, "Plano §7.1…§7.2 e §7.3", ADR sessão) e §5.5 bullet do 429 corrigido. Efeito no `nova_api`: nenhum código; ver notas cruzadas.
- **ADRs:** 0014 e 0015 (índice acima). A 0014 foi corrigida antes do commit por achados do senso-critico (dois CRITICO textuais) e o timeout extraído para a 0015 por decisão do usuário.
- **Notas cruzadas para o `nova_api`** (regra da raiz; levar à ADR de `skip_authorization` devida lá, `contrato-backend.md` §8, que deve citar a 0014): (1) `skip_authorization=True` na `Application` da SPA — até lá F5 passa pela tela de consentimento (tolerado); (2) declarar e testar `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_AGE`, `SESSION_EXPIRE_AT_BROWSER_CLOSE` — hoje defaults não declarados; `Strict` viraria senha a cada F5 sem erro observável; (3) `REFRESH_TOKEN_EXPIRE_SECONDS` finito — cada F5 grava `AccessToken`+`RefreshToken`+`IDToken` perpétuos que `cleartokens` não recolhe e a SPA nunca revoga (R1); (4) 429 de `/o/authorize/` é renderizado como JSON na origem do IdP, fora da SPA (a ADR 0016 do IdP já sabe).
- **Tech-debt / melhorias:**
  - **Aceito (senso-critico, CRITICO) → ADR 0014 e `CLAUDE.md` corrigidos:** a SPA RECEBE o `refresh_token` em toda troca de `code` e a lib o guarda em memória (`User.refresh_token`); "sem refresh" era falso. XSS persistente captura a resposta de `/o/token/` no próximo F5. Diferença real para `sessionStorage`: "leitura imediata" × "captura no próximo reload". Quem torna finito é o IdP (nota cruzada 3).
  - **Aceito (senso-critico, CRITICO) → ADR 0014 e contrato §5.5 corrigidos:** 429 tem dois destinos (`/o/token/` → `Callback`; `/o/authorize/` → fora da SPA).
  - **Aceito (senso-critico, QA) → ADR 0015 extraída:** três decisões numa ADR imutável tornariam o retune do timeout um `Substituído por` da 0014 inteira. Retune por evidência dos passos 5/6 = ADR que substitui a 0015.
  - Aceito e aplicado (senso-critico): imprecisões — 6–7 requisições por F5 (descoberta duas vezes: módulo renasce e o DOT não manda `Cache-Control`; preflight do `userinfo`); `loading` em `Landing` dura commit+paint+efeito, não microtask; timeout da lib cobre até os cabeçalhos (`clearTimeout` no `finally` do `fetch`), corpo sem abort — sem cenário real com Django não-streaming.
  - Aceito (senso-critico, R2) → nota cruzada 2: `SameSite=Lax` não ancorado no IdP.
  - Aceito como está (senso-critico): "Cancelar" no consentimento → `/callback?error=access_denied` → `Callback` mostra "Não foi possível concluir a autenticação." (mensagem torta para quem recusou de propósito; some com `skip_authorization`). Claim `name` sempre presente (`oidc_claim_scope` + scope fixo `openid profile email`); omissão impossível na stack atual — zod `z.string()` correto. Sessão SSO: 14 dias não deslizantes; expirada no meio do F5 vira senha, `state` sobrevive no `sessionStorage`. Token expirado em memória: refetch do `userinfo` por foco → 401 → `signin()` sem `returnTo` (cai em `/app`); aba em foco sem interação > 10 h mostra claims expiradas — débito aceito na ADR 0014.
  - Adiado, tarefa própria (PM, architect): estado "pendente" no botão durante `signin()` (até 15 s sem feedback com IdP lento). Validação da forma de `VITE_OIDC_ISSUER` no boot continua adiada (TASK-009).
  - Rejeitado (PM): timeout para `authGet`/JWKS do `jose` — fora do `UserManager`; `jose` tem 5 s próprios; `userinfo` pendurado mostra "Carregando…" indefinidamente — registrado na ADR 0015 como limite conhecido.
  - Rejeitado (architect): comentários de `userManager.ts` l.16 e docblock de `restoreSession()` "ficariam falsos" — com a 0014 corrigida ambos ficam verdadeiros (foram reescritos na tarefa; a l.19 cita a 0015).
  - Rejeitado (architect, QA): emendar plano §2 item 5, §5 último item e l.11 "nem os mapas" — decisão do usuário: plano fora do que a tarefa fecha fica como histórico (precedente TASK-002/004). `implementacao-contrato.md` Passo 3 diz "ex.: 10 s" — proposta, não decisão; não tocado.
  - Registrado (QA): T-04 teste 1 tem ~2,5 s de margem no teto de 19 s (piso de 14 s é o que prova); se oscilar em CI lento, alargar o teto. Glob `**/o/token` casa o fake, não `/o/token/` do IdP real — a suíte e2e é só contra o fake. e2e passou de ~5 s a ~21 s: teto do custo de espera longa; não adicionar mais testes de espera sem justificativa equivalente.
  - Registrado (QA, decisão do QA na 1ª passagem): AC-06 (RequireAuth com timeout), AC-09 (conexão recusada), AC-13 (`name-vazio` e2e) e AC-14 (F5 por SSO) constatados por specs ad hoc no scratchpad, não promovidos à suíte — nr sem decisão nova. AC-16 (429 real) fica para o passo 5.
  - Registrado: ADR 0014 corrigida tem ~159 linhas (acima de "meia a uma página"): a compressão foi de redação; cortar "Disposição dos adiados" ou alternativas foi recusado. Data da 0014 mantida em 2026-09-16 (aceitação original, não commitada).
  - Registrado: ADRs 0006/0010/0013 ficam defasadas em "§7.2 aberto" (imutáveis; a 0014 lista).
  - Incidente: `senso-critico` caiu por limite de sessão (429) logo após entregar o relatório completo; nada perdido.
- **Tipo:** decisão

## [2026-09-17] TASK-011 · Artefatos de deploy: `vercel.json`, CI, README, ADRs de deploy e do issuer (passo 4 de `implementacao-contrato.md`)
- **Decisão:** rota `/scaffold` (architect → writer → QA conformidade + senso-critico → writer para correções). Criados `vercel.json` (literal do contrato §5.2: rewrite universal + `Referrer-Policy: no-referrer` + `X-Content-Type-Options: nosniff`), `.github/workflows/ci.yml` (job `ci`: `checkout@v4`, `setup-node@v4` com `.nvmrc` + cache npm; `npm ci`, `typecheck`, `lint`, `format:check`, `test`; push na `main` + PR; sem `VITE_*`; sem e2e), ADRs 0016 e 0017. Modificados `package.json` e `package-lock.json` (`engines.node` `>=22.13 <23` — a Vercel lê `engines`, não `.nvmrc`; teto exclui o 24), README (linha do Node + seções "Contexto seguro", "CI", "Deploy (Vercel)"), contrato §9 três `[x]` (vercel.json; ADR issuer; ADR deploy) — "CI como gate" e "Node 22 fixado no projeto da Vercel" seguem abertos: verificáveis só no painel (passo 6). Decisões do usuário: `format:check` no CI além dos três comandos do contrato; A1 resolvido pela opção (a), corrigir a frase. Verificado: `npm run build` ok; typecheck/lint/format:check verdes; Vitest 94/94 em 13 arquivos; e2e 7/7 no fake; `npm ci` viável (lock em sincronia); `src/`, `dev/idp-fake/`, `.nvmrc` intocados. Efeito no `nova_api`: nenhum em código, `Application` ou CORS; ver notas cruzadas.
- **ADRs:** 0016 e 0017 (índice acima). A 0016 corrigida antes do commit por achados do senso-critico (A1, A2) e do QA (§6→§4).
- **Notas cruzadas para o `nova_api`** (regra da raiz): (1) não existe ADR de CORS no IdP (0001–0020); a ADR "CORS por origem exata; previews da Vercel fora" (`contrato-backend.md` §8) pode citar a 0016; (2) a ADR "issuer congelado" pode citar a 0017 — é a confirmação explícita que a 0007 do IdP pede; o laço só fecha quando ela existir lá; (3) C1: `integracao-rp.md` §2 recomenda "ler o `issuer` da descoberta, nunca um literal" — contradiz OIDC Discovery 1.0 §4.3 (o issuer é o prefixo da URL de descoberta, insumo, não resultado) e é falso quanto a atravessar troca de host sem reconfigurar; a ADR "issuer congelado" deve reescrever esse §; (4) C2: `contrato-backend.md` §4.1 fixa subdomínio dedicado **com** `/o`, mas a ADR 0007 do IdP tratava subdomínio como a alternativa em que o issuer iria para a raiz sem `/o`; a ADR do IdP precisa fechar explicitamente "subdomínio E `/o`"; (5) continua devida a correção da TASK-009 sobre CORS de descoberta/JWKS (`*` do DOT).
- **Tech-debt / melhorias:**
  - **Aceito (senso-critico, CRITICO A1) → ADR 0016 e README corrigidos:** "nada chega à `main` sem CI verde" era falso no fluxo real (13 commits, zero merges, push direto): a integração Git da Vercel publica no push e o CI roda depois, como aviso. Reescrito: o gate só existe pelo caminho do PR, com bypass de administrador desligado. Alternativa (b), deploy pelo próprio workflow (`vercel deploy --prebuilt --prod` após os testes), descartada por exigir segredos no GitHub — reabrir se o fluxo por PR não pegar.
  - Aceito e aplicado (senso-critico, MEDIO A2): o formulário de variáveis da Vercel marca os três ambientes por padrão; Preview com valores de produção devolveria o `code` à origem de produção com `state` ausente → frase no README e na ADR 0016 mandando desmarcar Preview.
  - Aceito e aplicado (senso-critico, A5): comentário em `ci.yml` acima de `jobs: ci:` — nome usado pela branch protection; renomear quebra o gate sem erro.
  - Aceito e aplicado (QA): `package-lock.json` raiz `engines` sincronizado; ADR 0016 Contexto `spa-nucleo.md` §6 → §4.
  - Adiado p/ passo 6 (senso-critico, BAIXO A3/A4): só a origem entregue ao IdP autentica — aliases (`<projeto>.vercel.app`, URL do deployment) devem ser redirecionados no painel (Domains) para ela; ambiente "Development" do painel é morto no fluxo documentado e `vercel env pull` sobrescreve `.env.local` — decidir se prescrever ou não ao configurar o painel.
  - Adiado, `/chore` própria (architect): tech-debt TASK-007 — `e2e/**` e `playwright.config.ts` fora do `tsc -b`; incluir em `tsconfig.node.json` pode revelar erros de tipo em `e2e/`.
  - Registrado, sem ação (architect): `contrato-frontend.md` §6.2 e `implementacao-contrato.md` passo 4b dizem "a build falha em `config.ts`" sem variáveis — falso: `tsc -b && vite build` não executa `config.ts`; a aplicação lança no boot (ADR 0005). Efeito idêntico; as ADRs 0016/0017 dizem o certo; corrigir a frase quando o contrato for editado. Também §6.2 "Node 22 fixado no projeto da Vercel" fica defasado com `engines` apertado (checklist segue verificável no log da build).
  - Registrado, sem ação: actions `@v4` sem pin por SHA (sandbox); máquina local em Node 23.6 → `EBADENGINE` (aviso; `nvm use`); ADR 0016 diz "o contrato exige só os três comandos" enquanto o CI roda quatro — coerente (o contrato exige três; `format:check` é acréscimo do usuário); senso-critico: `Referrer-Policy` protege menos do que a ADR sugere (default dos navegadores já corta query cross-origin; `index.html` não carrega recurso externo) — barato e inofensivo; `http` no issuer falha em "Entrar" (mixed content), não no callback; custo do e2e no CI seria mitigável com `actions/cache` — decisão "três comandos" sustenta-se sozinha; e2e fora do CI deixa escapar só regressão de redirect por bump manual de `oidc-client-ts` (sem Dependabot).
  - Confirmado pelo senso-critico com evidência: `TokenView` é `csrf_exempt` (`oauth2_provider/views/base.py:483-485`) e o CSRF do Django consulta `Origin` antes de `Referer` (`django/middleware/csrf.py:436-441`) — `no-referrer` não afeta o IdP; issuer literal é exigência de OIDC Discovery §4.3 e de I4 (`oidc-client-ts` não compara o `issuer` descoberto com `authority`), não dogma.
- **Tipo:** decisão

## [2026-09-17] TASK-012 · Integração em dev contra o IdP real local (passo 5 de `implementacao-contrato.md`)
- **Decisão:** verificação manual pelo usuário, sem pipeline de agentes e sem código. Contrato §7 itens 1–7: 7/7 contra `http://localhost:8000/o`, sem ressalva. Evidência: `.env.local` (não versionado) com `VITE_OIDC_ISSUER=http://localhost:8000/o` e `VITE_OIDC_REDIRECT_URI=http://localhost:5173/callback`; contrato §9 "Desenvolvimento" 4/4 `[x]`; fake e `e2e/idp.ts` intocados. Efeito no `nova_api`: nenhum (o IdP já havia cumprido CORS, `Application` e `skip_authorization`).
- **ADR:** nenhuma.
- **Tech-debt / melhorias:** pendências que o passo 5 deveria aproveitar para conferir (TASK-005: preflight de `/o/userinfo/` com `authorization` em `Allow-Headers`, 401 saindo com cabeçalho CORS, ramo "segundo 401 → falha sem redirect"; TASK-010 AC-16: 429 real) **não foram relatadas** — seguem abertas, sem dono; candidatas a `/review` própria ou à verificação em produção (TASK-013, AC-11).
- **Tipo:** observação.

## [2026-09-23] Pendências da TASK-005 contra o IdP real (fecha parte da nota da TASK-012)
- **Decisão:** conferência documental, sem código. Duas das pendências que a TASK-012 deixou abertas têm evidência: (1) preflight de `/o/userinfo/` com `authorization` em `Allow-Headers` — confirmado de forma implícita pelo item 1 do §7 do contrato (7/7): `localhost:5173` → `localhost:8000` é cross-origin, e o `GET` com `Authorization: Bearer` só chega às claims renderizadas se o preflight passar; (2) 401 saindo com cabeçalho CORS — confirmado do lado do IdP, com `curl` e `Origin` da SPA (`nova_api/docs/plano-contrato-backend.md`, checklist do passo 4). Seguem abertos, sem dono: o ramo "segundo 401 → falha sem redirect" (exige revogar o token no meio da sessão; tem cobertura unitária) e o 429 real (TASK-010 AC-16); candidatos à verificação em produção (passo 6).
- **ADR:** nenhuma.
- **Tipo:** observação.

## [2026-09-24] TASK-021 do IdP · ADR 0018 proposta (contraparte da 0027)

- **Decisão:** a SPA aceita o IdP de produção servido pelo Cloudflare Tunnel sem mudar código nem
  contrato; `VITE_OIDC_ISSUER` conferido byte a byte contra a descoberta; riscos da borda (tokens e
  cookie de sessão) e da chave na máquina de quem opera aceitos sob o gatilho da 0027; troca de
  chave não exige redeploy mas derruba o login por até 1–2 h (ADR 0013). Registro completo no
  `decisions.md` do `nova_api`, TASK-021.
- **ADR:** docs/adr/0018-aceitar-o-idp-de-producao-servido-pelo-cloudflare-tunnel-com-o-contrato-inalterado.md
- **Tech-debt / melhorias:** adiado — comentário de `src/auth/idToken.ts:11` contradiz a ADR 0013
  (diz que `createRemoteJWKSet` absorve troca de `kid`); `CLAUDE.md` ainda cita a AWS (linhas 9 e
  15), a revisar no passo 5 do plano do IdP.
- **Tipo:** decisão.

## [2026-09-29] TASK-014 · Modificação B, lado da SPA: "Sair" por logout iniciado pela RP

- **Decisão:** rota `/feature` completa (PM → architect → writer → QA → tester → QA → senso-critico
  → writer). `signout()` passa a `signoutRedirect()` sem `state`; `VITE_OIDC_POST_LOGOUT_REDIRECT_URI`
  obrigatória (`requiredUrl`, com barra final); na rejeição, `Area` navega a `/` com
  `history.state` `{ signoutFailed: true }` e a `Landing` alerta; resolução (bfcache) recarrega. Fake
  com `rpInitiatedLogout` e `logoutSource` que auto-submete `logout=yes` quando o `sub` do hint é o
  da sessão. `RequireAuth`/`AuthProvider` intocados (trava `hadSession` repetida na 0019). Verificado:
  typecheck/lint/prettier; Vitest 107/107, também sem `.env.local`; Playwright 9/9 (t06 renomeado
  para `t06-sair-logout-rp.spec.ts`, 3 casos); T-01..T-09 validados por mutação pelo QA. A 0019 foi
  corrigida antes do commit para seguir a ADR 0029 real do IdP (não o `retoques.md`): revogação só
  na Application; pergunta com hint sem linha; link relativo à 0029. Decisões do usuário no gate:
  corrigir docs sem código novo; barra final só documentada (contrato §4 e §6.2); divergência do
  fake só registrada.
- **ADR:** docs/adr/0019-sair-por-logout-iniciado-pela-rp-com-signoutredirect-sem-state.md; 0010
  com status "Substituído por ADR-0019"; 0004 intocada (cláusula de logout emendada pela 0019).
- **Notas cruzadas para o `nova_api`:** a ADR 0029 está "Proposto" e passa a Aceito com o caminho
  da 0019 na seção Decisão — a fazer lá (regra da raiz: uma ADR aponta para a outra).
- **Tech-debt / melhorias:**
  - Obsoleto (PM, CRITICO R4): `STRICT_REDIRECT_URIS` recusaria `http://localhost:5173/` — a 0029 já
    o faz acompanhar `BEHIND_TLS_PROXY`; dev aceita http.
  - Aceito e aplicado (PM, CRITICO R2/R3; observações sobre `state`, 0004, 0010): ver Decisão.
  - Aceito e aplicado (QA, ALTA): `config.test.ts` dependia do `.env.local` e quebraria o CI → T-01.
  - Aceito, documentado sem código (senso-critico, MEDIO): o alerta só cobre a rejeição dentro da
    página; recusas do IdP depois da navegação (túnel fora, 400 por destino ou chave) deixam a
    sessão Django viva, e "Voltar" + SSO devolvem a pessoa logada. Reabrir se virar incômodo real.
  - Aceito, documentado sem código (senso-critico, MEDIO): barra final do
    `post_logout_redirect_uri` sem proteção no boot nem no admin; conferir no deploy (§6.2).
  - Aceito, registrado (senso-critico, MEDIO): o fake auto-submete com hint sem linha no banco (duas
    abas); o real pergunta. Sem cobertura e2e.
  - Aceito sem ação (senso-critico, BAIXO): `signoutFailed` reaparece em reload/"Voltar" da mesma
    entrada — afirmação continua verdadeira. Ordem `removeUser`/descoberta da lib fixada por
    `userManager.lib.test.ts` (a1/a2).
  - Aceito, operação (architect, ALTO): ordem de implantação IdP → cadastro do destino → variável na
    Vercel (Production) → SPA; sem a variável o boot cai inteiro.
  - Aceito sem ação (architect, MEDIO): reload do bfcache só tem cobertura unitária; ADR 0004 fica
    com a cláusula antiga no corpo (imutável), com ponteiro em `server.js`.
  - Adiado, `/chore` própria: `RequireAuth.tsx:15-16` e `AuthProvider.tsx:25` citam a ADR 0010
    substituída → trocar para 0019. Idem comentário órfão da ADR 0012 no `.env.local` (local).
  - Aceito sem ação: T-08 com `waitForTimeout(500)` por volta (frágil em máquina lenta); linha > 100
    colunas no cabeçalho de `userManager.lib.test.ts` (cosmético); commit deve levar o rename do t06.
  - Adiado, verificação manual (AC-14): contra o IdP real local — "Sair" → landing; "Entrar" pede
    senha; `access_token` anterior 401 em `/o/userinfo/`; raiz do IdP sem sessão. Exige
    `post_logout_redirect_uris` = `http://localhost:5173/` na Application de dev e
    `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` no `.env.local` (já feito). Em produção, depois do deploy.
- **Tipo:** decisão.

## [2026-09-30] TASK-013 · Publicar a SPA em produção na Vercel — encerrada como obsoleta

- **Decisão:** encerrada por decisão do usuário, sem cumprir os blocos B–D. Os critérios de
  fechamento (AC-12 e AC-14) marcavam checklists de documentos de trabalho que não existem mais
  (plano de pré-implementação, contrato de front-end, roteiro de implementação). O status quo vale
  como aceito: a SPA está em produção em `https://spa-idp.vercel.app`, integrada ao IdP servido
  pelo Cloudflare Tunnel (ADR 0018), e toda ADR da SPA está aceita (0010 substituída pela 0019). A
  verificação em produção (AC-08 a AC-10) não foi registrada por esta tarefa; AC-02 (Node 22.x no
  painel) e AC-04 (branch protection) também não foram confirmados. Nenhum código nem arquivo de
  `docs/` tocado.
- **ADR:** nenhuma nova. A 0018 passou a Aceito em 2026-09-29, na revisão das ADRs (linha do
  índice atualizada).
- **Tech-debt / melhorias:**
  - Aceito como status quo (senso-critico TASK-011, BAIXO A3): a origem é o alias
    `https://spa-idp.vercel.app`; URLs de deployment e aliases de branch não autenticam
    (`redirect_uri` divergente) e nada se configura em Domains. Renomear o projeto Vercel muda a
    origem e exige nova entrega ao IdP.
  - Aceito como status quo (senso-critico TASK-011, BAIXO A4): o ambiente Development do painel não
    é cadastrado; `vercel env pull` sobrescreveria o `.env.local`.
  - Aceito, registrado (orquestrador, MEDIO): incidente de 2026-09-18 — o primeiro deploy construiu
    `origin/main` 7 commits atrás do local (app exigia `VITE_IDP_ACCOUNT_URL`, `/callback` com 404).
    A integração Git da Vercel só vê o que está no remoto; erro de variável que não existe mais no
    código é o sintoma.
  - Adiado, sem dono: as pendências herdadas (AC-11) — ramo "segundo 401 → falha sem redirect" e
    429 real — perdem esta tarefa como destino; candidatas a `/review` própria.
- **Tipo:** decisão.

## [2026-10-06] TASK-015 · Telas de conta — ponto de controle da F0 (ADR 0020 e documentação)

- **Decisão:** a tarefa segue ativa (F1–F5 pendentes); esta entrada dá disposição aos apontamentos
  da F0. Rota `/feature` completa na F0: PM → gate (Fase 2) → architect → autorização → writer → QA
  → writer (5 ajustes) → QA (APROVADO) → senso-critico (RESSALVA). Gravados a ADR 0020 "Proposto" e
  os ajustes em `spa-nucleo.md`, `contrato-idp.md` (§11 nova, §1–§10 sem renumerar),
  `arquitetura.md`, `seguranca.md`, `CLAUDE.md`, `.env.example` e `README.md` l.56; 0004, 0008 e
  0012 intactas; typecheck e Vitest 107/107 verdes. Decisões do usuário no gate adversarial:
  (1) aceita o risco do cadastro do IdP gravar aceite dos termos v1 enquanto a SPA de produção não
  tem `/termos` nem `/privacidade`; (2) **commit local único depois de F5; push na `main` (que
  publica na Vercel, ADR 0016) só depois do IdP em produção e do aceite conjunto 0020/0031**;
  (3) D-6 mantida: a guarda fecha `/app` em qualquer erro do GET da conta, inclusive busca de fundo
  com cache.
- **ADR:** docs/adr/0020-abrir-as-telas-de-conta-sobre-a-api-de-conta-com-as-paginas-de-senha-no-idp.md
  (Proposto; par com a 0031 do IdP; substituirá a 0012 no aceite conjunto).
- **Propostas entregues ao usuário para o IdP:** `docs/integracao-rp.md` l.250–252 (a SPA não lê
  `WWW-Authenticate` nem `Retry-After`); ADR 0031 l.14/l.161 e `docs/arquitetura.md` do IdP citarem
  "ADR 0020 da SPA" pelo número. Efeito na SPA: nenhum.
- **Tech-debt / melhorias:**
  - Aceito e aplicado (PM, OBS): D-16 na ADR; 0020 sem §N, documento de trabalho nem diretório;
    índice com 0020 Proposto e 0012 aceita.
  - Aceito e aplicado (architect, MEDIO): 0020 emenda também a 0004; (BAIXO) pares mantêm
    0012↔0023 até o aceite; `README.md` corrigido; `CLAUDE.md` sem "proposta".
  - Aceito, diretriz da F1 (architect, BAIXO): `authSend` só alcança `config.idp.api`.
  - Aceito e aplicado (QA, OBS ×5): escopo da emenda à 0004; `insufficient_scope` só no desafio;
    proibição de `fetch` às páginas atribuída a I1/I8; pontuação em `seguranca.md`; quebra em 100
    colunas.
  - Aceito sem ação (architect/writer/QA, OBS): 0020 passa de uma página; parágrafos sob o status
    (precedente 0019 e 0031 do IdP); título diferente do slug.
  - Rejeitado (QA 2ª passagem, MEDIA): "a ADR 0031 ainda não existe com esse número" — existe no
    disco do IdP.
  - Adiado, fim da F4 (architect, writer, QA): os documentos descrevem código de F1–F4
    (`config.idp`, `authSend`, `signup()`, `src/api/conta.ts`, `src/termos.ts`, `RequireTermos`,
    páginas novas); conferir cada caminho e símbolo no código.
  - Adiado, antes da F1 com a reconferência §3.5 (senso-critico, BAIXO): `contrato-idp.md` §11.3
    diz "Cadastro só pelo `prompt=create`", mas a tela de login do IdP liga direto ao cadastro
    (`login.html:50`); a volta da recuperação diz "Ir para a aplicação", não "Entrar".
  - Aceito, risco do usuário (senso-critico, CRITICO): cadastro do IdP grava `termos_versao`
    vigente (`cadastro.html:19`, `paginas.py:122-129`) com links a `{SPA_URL}/termos`; na janela
    IdP-antes-da-SPA, aceite registrado sem texto publicado. Junto (OBS): a D-2 só vale no aceite
    feito pela SPA.
  - Aceito, decisão (2) acima (senso-critico, MEDIO): push = implantação na SPA. Também cobre a OBS
    do núcleo afirmar a 0020 enquanto a 0012 está aceita: nada chega à `main` remota antes do aceite.
  - Rejeitado por decisão do usuário (senso-critico, MEDIO): guarda só sem cache — D-6 mantida.
  - Aceito sem ação (senso-critico, BAIXO): trava por URL — após `signin()` falho, "tentar de novo"
    na guarda repete o erro até o reload.
  - Adiado, encerramento da tarefa (PM, OBS): texto final dos termos e da privacidade vira
    `BLOCK-NNN` de implantação depois da F5.
  - Adiado, ato de aceite (architect, OBS): `CLAUDE.md` do observatório ganha o par IdP 0031 ↔ SPA
    0020 — proposta ao observatório.
- **Tipo:** decisão.

## [2026-10-06] TASK-015 · Telas de conta — ponto de controle da F1 (fundação)

- **Decisão:** F1 fechada, sem commit (commit único depois de F5). Regra nova da pessoa usuária:
  a SPA segue **independente do IdP** — não lê o IdP; o que depende dele vai para
  `docs/apontamentos.md` (A-01..A-10). Rota: writer → QA (RESSALVA, T-01..T-10) → writer (relatório
  alinhado) → tester (verde, mutações) → QA (APROVADO) → senso-critico (RESSALVA) → decisão do
  usuário → writer → tester (T-08'). Implementado: scope `conta`; `config.idp` sobre a origem do
  issuer; `authSend(method, resource: keyof typeof config.idp.api, json?)` (chave, não URL: o tipo
  impede escrita fora da API); `401` → `signin(path+search+hash)`; trava `spa.reauth` por URL do
  recurso, apagada por qualquer resposta não-`401` da mesma URL; `403` sem ramo; claims novas
  opcionais; `signup()` com `prompt: "create"`; fake com scope, claims, contas em memória,
  `sem-aceite`/`nao-confirmado`, retirada de `create` e API `/api/conta/`. Verificado: typecheck,
  lint, format; Vitest 133/133; e2e 9/9 (t03–t08). **Decisão do usuário (D-3):** tipo inesperado
  ou `null` em `email_verified`, `nickname`, `updated_at` é descartado (`.optional().catch(undefined)`)
  e não recusa o login; AC-13 revisado; ADR 0020, relatório e contrato §5 alinhados.
- **ADR:** 0020 (Proposto) ajustada na D-3 e na emenda à 0008 ("resposta que não seja `401`").
- **Tech-debt / melhorias:**
  - Aceito e aplicado (QA, CRITICO): 9 falhas por mudança de especificação → T-01, T-02, T-03, T-07,
    T-10; (QA, OBS) assinatura de `authSend` alinhada no relatório de trabalho.
  - Aceito e aplicado (senso-critico, MEDIO): D-3 cumprida no código (decisão do usuário).
  - Aceito e aplicado (senso-critico, coerência): D-14 "qualquer resposta não-`401`" na ADR 0020 e
    no relatório.
  - Aceito, A-09 e A-10 em `docs/apontamentos.md` (writer, QA, senso-critico): aproximações do fake
    (mensagens, desafio sem token, parâmetros do `insufficient_scope`, ordem dos `403`, PATCH vazio,
    `prompt` combinado); token revogado/vencido na API deve dar `401`, e a F5 deve exercitá-lo.
  - Adiado, F2/F3 (QA, OBS; writer, OBS): trava guarda uma URL só — a guarda precisa terminar o
    GET da conta antes de outras chamadas autenticadas; alternância não é cortada (consequência da
    ADR 0020).
  - Aceito sem ação, conferir no QA da F3 (senso-critico, BAIXO): trava deixada por "Reenviar"
    (`POST confirmacao`) não é apagada pelos GETs e bloqueia um novo login futuro na mesma aba;
    reload resolve.
  - Adiado, F2/F5 (QA, OBS): e2e não prova a concessão do scope `conta` (o fake ignora scope
    desconhecido); provado pelos e2e que chamam a API e pela integração real.
  - Aceito sem ação (tester/QA, BAIXO/OBS): mock de `../config` em `http.test.ts` não checado por
    tipo; `fakeConfig.oidc.scope` em `userManager.test.ts:12` sem `conta` (alinhar quando o arquivo
    for tocado); `authSend` com `json` falsy definido vai ao ramo de corpo; `signup` no
    `AuthProvider` sem teste próprio (repasse); `location` do jsdom persiste entre casos.
  - Rejeitado (tester): "a produção parecia commitada" — HEAD segue 8396e9a.
- **Tipo:** decisão.

## [2026-10-06] TASK-015 · Telas de conta — ponto de controle da F2 (conta, guarda e termos)

- **Decisão:** F2 fechada, sem commit. `src/api/conta.ts`, `src/termos.ts` (marcadores),
  `RequireTermos` (guarda abaixo de `RequireAuth`; o GET da conta termina antes de a área montar),
  `BotaoSair`, `AceiteDosTermos`, `/termos` e `/privacidade` públicas. A volta ao destino depois do
  aceite fica na guarda, não na página (evita corrida: a guarda desmontaria a página antes do
  `onSuccess` do `mutate`); destino aceito só `/app` ou `/app[/?#]…`. Fake com logins
  `<estado>:<sufixo>` para e2e determinístico. Decisões do usuário no gate: (1) `/app/termos` tem
  link "Excluir conta" para a página do IdP — recusar os termos não impede excluir; (2) a guarda
  mostra a mensagem de 429; chave do limite perguntada ao IdP (A-12); (3) critério de "aceito"
  durante a janela de troca de versão fica para antes da primeira troca (A-13; ADR 0020 e contrato
  §10 com a ressalva). Verificado: typecheck, lint, format; Vitest 179/179; e2e 10/10 (t11 duas
  vezes com servidor reaproveitado); mutações em T-01..T-04, T-03', T-04(g)', T-11, T-12;
  RequireTermos e AceiteDosTermos estáveis em 16 execuções concorrentes.
- **ADR:** 0020 (Proposto): saída para exclusão na Decisão; negativas com a troca de versão em
  aberto e o formulário perdido por refetch que falha.
- **Tech-debt / melhorias:**
  - Aceito e aplicado (QA, MEDIA-1, BAIXA-2/3/4; QA 2ª, MEDIA Q-1, BAIXA Q-2/Q-3): fake com sufixo;
    comentário e `destino` estrito; §4.3 alinhada; T-03' sem `flush` fixo; T-04(g)' com router
    real.
  - Aceito e aplicado (senso-critico, MEDIO ×2): link de exclusão; 429 na guarda + A-12.
  - Adiado, antes da primeira troca de versão (senso-critico, MEDIO): A-13.
  - Aceito, registrado (senso-critico, MEDIO): formulário perdido quando uma nova busca da conta
    falha (D-6) — ADR 0020 e relatório §7; reavaliar na F3 se incomodar.
  - Aceito, A-11 (writer): formato das datas e corpo dos `403` dependem do IdP.
  - Aceito sem ação (QA, BAIXA): tela em branco em "Tentar de novo" sem cache (v5 volta a
    `pending`); 204 seguido de GET sem aceite sem feedback; "Voltar ao início" vai a "/"; fake sem
    `conta_inativa` (AC-17 só na unidade); `BotaoSair` sem teste isolado; sem e2e de falha do GET.
  - Aceito sem ação (senso-critico, BAIXO): trocas de rota da guarda sem gestão de foco (padrão já
    existente na SPA).
  - Adiado, `/test-gap` própria (tester, OBS): `src/auth/idToken.test.ts` estoura 5 s gerando
    chaves RSA sob 8 suítes concorrentes (4/16); `AceiteDosTermos.test.tsx` d/e/f ainda usam
    `flush` fixo (verdes em 16/16).
  - Adiado, próxima rodada de docs (writer, BAIXA): §7 do relatório sem a ressalva do A-13.
- **Tipo:** decisão.

## [2026-10-06] TASK-015 · Telas de conta — ponto de controle da F3 (Minha conta e área)

- **Decisão:** F3 fechada, sem commit. `/app` com saudação (`nickname || first_name || email`),
  faixa "Confirme seu e-mail" com "Reenviar" e link "Minha conta"; `/app/conta` com formulário de
  nome, sobrenome e apelido (inicializado uma vez; não acompanha o refetch), "Acesso", links `<a>`
  ao IdP, zona de perigo e avisos `?aviso=` lidos de um `Map` e retirados da URL. Só a guarda busca
  a conta ao montar (`useConta(sub, {refetchOnMount:false})` nos filhos): 1 GET na chegada, 0 por
  navegação, 1 por foco. Decisões do usuário no gate: PATCH só com os campos alterados (campo não
  tocado não desfaz edição feita por outro caminho; no mesmo campo vence a última escrita — ADR
  0020 e relatório §7); `onMutate` cancela a busca da conta em voo; aviso "Senha trocada." (sem
  prometer encerrar sessões); foco devolvido (primeiro campo inválido ou "Salvar") e região viva
  estável. Verificado: typecheck, lint, format; Vitest 236/236; e2e 13/13 (t10, t12 duas vezes);
  mutações em T-01..T-18 da F3.
- **ADR:** 0020 (Proposto): negativa "no mesmo campo, vence a última escrita".
- **Tech-debt / melhorias:**
  - Aceito e aplicado (QA, CRITICO W-01): GET da conta duplicado; (QA, OBS W-02) `MENSAGENS` como
    `Map`; (QA 2ª, BAIXO) T-07a sem depender do fuso.
  - Aceito e aplicado (senso-critico, MEDIO e BAIXO ×2): PATCH parcial; cancelamento no envio; foco
    e anúncio; texto do aviso.
  - Adiado, A-11 item (3) (senso-critico, BAIXO): semântica de `senha_alterada_em: null`; a SPA
    mostra "nunca alterada" até a resposta do IdP.
  - Aceito sem ação (senso-critico, OBS): links ao IdP descartam o digitado não salvo (mesma classe
    da D-7).
  - Adiado, F5 (QA, writer, OBS): aviso `senha-trocada` depende de a query sobreviver ao novo login
    — conferir contra o IdP real.
  - Aceito sem ação (QA, OBS): segundo `401` em "Reenviar" na mesma aba dá "Não foi possível
    reenviar." sem re-auth; o foco seguinte re-autentica. `/o/me` refeito a cada ida a `/app`
    (anterior à F3). Testes antigos de `Area` sem conta no cache. T-03 depende de
    `visibilitychange` em `window`. Sem e2e de 400 no PATCH. `mutate({})` no hook enviaria corpo
    vazio (só a tela impede). Dois `role="status"` com aviso presente.
- **Tipo:** decisão.

## [2026-10-06] TASK-015 · Telas de conta — ponto de controle da F4 (landing)

- **Decisão:** F4 fechada, sem commit. Landing com "Criar conta" (`signup()`, `prompt=create`;
  falha "Não foi possível iniciar o cadastro."; nota sobre sessão aberta no IdP), "Esqueci a
  senha" (`<a>` para `config.idp.paginas.recuperarSenha`) e avisos `?email=`/`?conta=` lidos de um
  `Map` e retirados da URL com `replace` (preserva outros parâmetros, hash e `state`); a limpeza não
  roda quando autenticado (evita desfazer o `<Navigate to="/app">`). Conferência adiada da F0
  feita: todo caminho e símbolo citado pelos documentos existe e bate com o código; 6 imprecisões
  corrigidas em `arquitetura.md` e `seguranca.md`. Verificado: typecheck, lint, format; Vitest
  254/254; e2e 18/18 (t09 e t13 duas vezes); mutações nos T de decisão da Landing.
- **ADR:** nenhuma nova; 0020 segue "Proposto".
- **Tech-debt / melhorias:**
  - Aceito e aplicado (QA, OBS ×6 e BAIXA): defeito latente da Landing; documentação alinhada.
  - Aceito, registrado como passo da F5 e A-14 (senso-critico, MEDIO): "Criar conta" com sessão
    aberta no IdP — a nota da Landing e o contrato §4 afirmam algo que só o IdP real prova.
  - Aceito, registrado como passo da F5 (senso-critico, MEDIO): Voltar depois da exclusão (ou da
    troca de senha) pode trazer `/app/conta` do bfcache com os dados; se acontecer, reabrir a D-9.
  - Aceito sem ação (senso-critico, BAIXO): sessão invisível do IdP (ADR 0014) desvia "Esqueci a
    senha" e "Entre para continuar" para a conta da sessão aberta; a saudação mostra qual.
  - Adiado, F5/aceite (QA, OBS): `CLAUDE.md` e `spa-nucleo.md` tratam a 0020 como vigente enquanto
    ela é "Proposto" — o aceite conjunto deve acontecer antes ou junto do commit.
  - Aceito sem ação (QA, OBS): `redirecting` compartilhado entre `signin` e `signup`;
    `RequireTermos` importa `pages/BotaoSair` (camada invertida); dois hooks de aviso parecidos
    (Landing preserva `state`, Conta não); t09 prova só o parâmetro `prompt=create`.
- **Tipo:** decisão.

## [2026-10-06] TASK-015 · Telas de conta — respostas do IdP aplicadas (antes da F5)

- **Decisão:** a sessão do IdP respondeu os apontamentos (`docs/apontamentos.md`, "Resposta do
  IdP"). Nada reabre decisão. Confirmados: A-04 (árvore de trabalho bate), A-10 (token revogado
  dá `401`), A-12 (limite por IP do cliente via `CF-Connecting-IP`, não global), A-14 (`create`
  com sessão aberta entra na conta existente). Resolvidos no IdP: A-01, A-02. Alinhado na SPA:
  `senha_alterada_em: null` → "sem registro" (A-11.3); datas `isoformat()` UTC `+00:00` com
  microssegundos opcionais já interpretadas por `new Date` (A-11.1); fake alinhado ao A-09 (desafio
  do `403` sem `scope`, `401` sem `error` sem token, mensagens reais, `required` em `versao`, PATCH
  vazio não grava); contrato §11 registra os detalhes. Verificado: Vitest 256/256, e2e 18/18.
- **Tech-debt / melhorias:**
  - Adiado, F5: parse de microssegundos só conferido no V8 — conferir num segundo navegador (se
    falhar, a tela mostra "data indisponível").
  - Aceito sem ação: o fake cria conta com `senha_alterada_em: null` (o IdP real carimba na
    criação) — mantém o único caminho e2e do `null`; fixture de `http.test.ts:178` ainda com
    `scope="conta"` (cosmético; fora da autorização); sem texto pt-BR para `required` (inalcançável
    pela tela; reserva em inglês).
  - Aceito sem ação: a frase "O campo Estado … não foi alterado" da resposta do IdP ficou
    desatualizada; o documento é de trabalho e será retirado.
- **Tipo:** decisão.

## [2026-10-06] TASK-015 · Telas de conta — F5, integração contra o IdP real de desenvolvimento

- **Decisão:** F5 verde contra o IdP real em `https://localhost/o` (árvore de trabalho, sem
  commit), com a SPA de dev em `https://localhost:5173` (mkcert; `vite.config.ts` liga https só com
  `SPA_DEV_TLS_CERT`/`SPA_DEV_TLS_KEY`; e2e seguem em http contra o fake). BLOCK-001 (IdP de dev só
  aceita redirect https) resolvido pela SPA em https, decisão do usuário, sem ADR; o IdP ajustou
  `CORS_ALLOWED_ORIGINS`, a Application de dev e `SPA_URL` (A-15). Passaram, por Playwright descartável
  no scratchpad: cadastro por "Criar conta" volta logado (sub UUID); faixa e "Reenviar" (204);
  confirmação → `/?email=confirmado` com aviso e query limpa; "Entrar" por SSO; faixa some; PATCH só
  com o campo alterado e persistência no reload; troca de e-mail com aviso; troca de senha com
  "Senha trocada." e data pt-BR; token revogado em outra aba → `401` (conta e userinfo juntos) →
  um novo login, sem laço; Sair volta a `https://localhost:5173/`; "Esqueci a senha" → redefinição →
  "Ir para a aplicação" → login com a senha nova; A-14 (Criar conta com sessão aberta entra na conta
  existente); desativar → aviso, login recusado pelo IdP; apagar → aviso; Voltar depois de apagar
  passa por páginas do IdP que pedem login e não mostra dados. A guarda faz um só GET da conta por
  carga.
- **Tech-debt / melhorias:**
  - Não verificado: datas com microssegundos num segundo navegador (só Chromium instalado; o IdP
    omitiu microssegundos nas datas vistas); guarda de termos com conta real de `termos_versao` vazio
    (coberta pelo e2e t11 contra o fake).
  - Inconclusivo, sem defeito observado: bfcache da D-9 no Chromium headless (o Voltar passou pelas
    páginas do IdP).
  - Pendente de autorização: `README.md:49` e relatório de pré-implementação (l.448) ainda citam
    `http://localhost:8000/o`.
  - Contas de teste `f5*-…@example.com` ficaram no banco local do IdP.
- **Tipo:** decisão.

## [2026-10-06] TASK-015 · Telas de conta — encerramento

- **Decisão:** tarefa fechada pela pessoa usuária depois da F5 verde em desenvolvimento, sem
  commit. Apontamentos e bloqueios sem pendência. O que a mantinha aberta passa a ser trabalho de
  outro contexto, nesta ordem: (1) aceite conjunto das ADRs 0020 e 0031 do IdP (A-03); (2) commit
  local único dos dois lados, só depois do aceite; (3) texto da versão 1 dos termos e da política
  de privacidade em `src/termos.ts`, hoje com marcadores (A-08); (4) IdP em produção primeiro e
  descoberta conferida: scope `conta`, `email_verified`, `create` (A-06); (5) push da SPA, que
  publica na Vercel; (6) F5 repetida em produção e contrato comparado com o do IdP. Quem retomar
  atualiza a linha da 0020 no índice com a data do aceite.
- **ADR:** docs/adr/0020-abrir-as-telas-de-conta-sobre-a-api-de-conta-com-as-paginas-de-senha-no-idp.md
  (índice acima; Proposto).
- **Tech-debt / melhorias:**
  - Adiado, integração: passos da jornada §11 não registrados contra o IdP real: guarda de
    termos com conta real sem aceite (passo 1); `nickname` e e-mail de boas-vindas (passo 2);
    aviso ao e-mail antigo e nova confirmação depois da troca (passo 3); e-mail em maiúsculas
    (passo 5); mensagem própria de conta desativada, e-mail apagado livre para novo cadastro e
    recusa para conta administrativa (passo 6); requisitos de senha nas páginas do IdP (§4.10).
  - Adiado, integração: datas com microssegundos num segundo navegador; bfcache da D-9
    inconclusivo no Chromium headless.
  - Adiado, `/test-gap`: `idToken.test.ts` instável sob carga; espera de duração fixa em
    `AceiteDosTermos.test` (d/e/f).
  - Adiado, docs: §7 do relatório de pré-implementação com a ressalva do A-13; o relatório é
    retirado quando o conteúdo estiver nos docs.
  - Adiado, antes da 1ª troca de versão dos termos: A-13 (janela e critério de "aceito", no IdP).
  - Resolvido depois da entrada da F5: `README.md` e relatório já citam o issuer de dev
    `https://localhost/o`.
  - Operação: contas de teste `f5*-…@example.com` no banco local do IdP.
- **Tipo:** decisão.
