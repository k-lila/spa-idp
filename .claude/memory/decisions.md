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
