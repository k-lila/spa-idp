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
