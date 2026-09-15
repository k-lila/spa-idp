# nova_api_SPA

SPA React + TypeScript que atua como Relying Party OIDC do `monolito-idp`.

Requer Node >= 22.13 (`.nvmrc` fixa 22) e npm.

| Script                 | Faz                           |
| ---------------------- | ----------------------------- |
| `npm run dev`          | dev server do Vite            |
| `npm run build`        | typecheck + build de produção |
| `npm run preview`      | serve o `dist/` gerado        |
| `npm run typecheck`    | `tsc -b`                      |
| `npm run lint`         | ESLint                        |
| `npm run format`       | Prettier (escreve)            |
| `npm run format:check` | Prettier (só verifica)        |

Arquitetura, invariantes e decisões: `docs/` (comece por `docs/spa-nucleo.md`; ADRs em `docs/adr/`).
