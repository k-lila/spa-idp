# SPA

SPA React + TypeScript que atua como Relying Party OIDC do `monolito-idp`.

Requer Node 22 (`>=22.13 <23` em `engines`; `.nvmrc` fixa 22) e npm.

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

## Contexto seguro

A SPA só autentica em `https://` ou em `http://localhost`: o PKCE da biblioteca e a verificação do
`id_token` (`jose`) usam `crypto.subtle`, que o navegador não expõe em `http://<ip-da-lan>` nem em
`http://<hostname>` — ali "Entrar" falha antes de sair da página. Testar de outro dispositivo exige
`https` e uma `redirect_uri` correspondente registrada no IdP.

## CI

`.github/workflows/ci.yml` roda `npm ci`, `typecheck`, `lint`, `format:check` e `test` em todo push
na `main` e em todo pull request, em Node 22 (`.nvmrc`), sem variáveis `VITE_*`. Os e2e (Playwright)
não rodam no CI: `npm run test:e2e` local antes de abrir o PR. O gate "produção só com CI verde" é
configuração externa e só vale pelo caminho do pull request: branch protection na `main` exigindo
o check `ci` no GitHub (bypass de administrador desligado), e branch de produção = `main` no
projeto da Vercel. Num push direto à `main` a Vercel publica no push e o CI roda depois, como
aviso (ADR 0016).

## Deploy (Vercel)

- `vercel.json`: rewrite de toda rota para `/index.html` (sem ele `/callback` responde 404 e o
  `code` morre) e os cabeçalhos `Referrer-Policy: no-referrer` e `X-Content-Type-Options: nosniff`.
- Variáveis `VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID` e `VITE_OIDC_REDIRECT_URI` no painel da
  Vercel, **por ambiente**. Production: `https://<dominio-do-idp>/o` (sem barra final, ADR 0017),
  o `client_id` de produção e `https://<spa>/callback`. Preview: nenhuma — a build passa, mas a
  aplicação lança no boot (`src/config.ts`) e não autentica, de propósito. Development: os do IdP
  local (`http://localhost:8000/o`). Nunca o mesmo valor em dois ambientes; nunca um
  `.env.production` no repositório. O formulário de variáveis do painel marca os três ambientes
  por padrão: desmarcar Preview ao cadastrar os valores de produção.
- Node 22: a Vercel ignora `.nvmrc` e lê `engines` do `package.json` (`>=22.13 <23`). Conferir a
  versão no log da build; o campo "Node.js Version" do painel fica em 22.x, redundante.
- Previews não autenticam: a origem muda a cada deploy e o IdP compara origem (CORS) e
  `redirect_uri` por igualdade exata. Nunca pedir `*.vercel.app` ao IdP; se for preciso, um alias
  estável ganha cliente próprio no IdP (`docs/contrato-frontend.md` §4).

Arquitetura, invariantes e decisões: `docs/` (comece por `docs/spa-nucleo.md`; ADRs em `docs/adr/`).
