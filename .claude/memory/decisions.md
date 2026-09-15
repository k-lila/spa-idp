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
