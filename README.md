# nova_api_SPA

SPA React + TypeScript que atua como Relying Party OIDC do `monolito-idp`.

Requer Node >= 22.13 (`.nvmrc` fixa 22) e npm.

Configuração: copie `.env.example` para `.env.local` (ignorado pelo git). Sem as variáveis
`VITE_*` a aplicação não sobe. Em dev, rode `npm run idp` em um terminal e `npm run dev` em
outro; login no fake: `fake-user-1`, senha qualquer.

| Script                     | Faz                                                           |
| -------------------------- | ------------------------------------------------------------- |
| `npm run dev`              | dev server do Vite                                            |
| `npm run idp`              | IdP fake local (`oidc-provider`) em `http://localhost:9000/o` |
| `npm run build`            | typecheck + build de produção                                 |
| `npm run preview`          | serve o `dist/` gerado                                        |
| `npm run typecheck`        | `tsc -b`                                                      |
| `npm run lint`             | ESLint                                                        |
| `npm run format`           | Prettier (escreve)                                            |
| `npm run format:check`     | Prettier (só verifica)                                        |
| `npm run test:e2e:install` | baixa o Chromium do Playwright (1x por máquina)               |
| `npm run test:e2e`         | E2E (Playwright); sobe IdP fake e SPA sozinho                 |

Arquitetura, invariantes e decisões: `docs/` (comece por `docs/spa-nucleo.md`; ADRs em `docs/adr/`).
