# 0004. Rodar o IdP fake local com `oidc-provider` em JavaScript ESM, montado em `/o`

## Status

Aceito — 2026-09-15

## Contexto

O `monolito-idp` está offline e sem endereço. A SPA precisa exercitar o fluxo real de
redirect + PKCE (I2), discovery (I5) e validação do `id_token` (I4) antes de o back-end
existir, e os testes e2e (plano §8, etapa 7) precisam de um IdP reproduzível na máquina e
no CI. O plano (§6) pede um servidor Node em `dev/idp-fake/` com `oidc-provider`,
publicado em `http://localhost:9000/o`. Faltava decidir a linguagem do fake (TS rodado por
`node` falha em Node 22.13–22.17 e não passa por `tsc -b`, que só inclui `vite.config.ts`),
onde vivem suas dependências, como montar o sufixo `/o`, e até onde o fake deve espelhar o
IdP real. O `CLAUDE.md` pede a solução mais simples que funciona; a ADR 0001 proíbe um
segundo lockfile.

## Decisão

Vamos escrever o fake em **um único arquivo JavaScript ESM**, `dev/idp-fake/server.js`,
executado por `node` (`npm run idp`), com `oidc-provider` e `express` como
`devDependencies` do `package.json` raiz. O `express` monta o provider em `/o`, de modo
que o issuer é `http://localhost:9000/o`, como no IdP real. O fake espelha só o
**contrato que a SPA consome**: um client público (`token_endpoint_auth_method: none`)
com PKCE S256 obrigatório e `redirect_uri` `http://localhost:5173/callback`; claims
`sub`, `name`, `email` (sem `email_verified`) emitidas no `id_token`
(`conformIdTokenClaims: false`, como faz o `django-oauth-toolkit`); refresh token sempre
emitido; `rpInitiatedLogout` desligado (o IdP real não anuncia `end_session_endpoint`);
CORS liberado para `http://localhost:5173` nos endpoints por client. A chave RS256 é
gerada no boot com `node:crypto`. Login e consentimento usam `devInteractions`: qualquer
senha é aceita e o `sub` é o login digitado (`fake-user-1` por convenção); `name` e
`email` são fixos. As rotas ficam nas defaults do `oidc-provider` (`/auth`, `/me`), que
não coincidem com as do IdP real — de propósito: a SPA só pode chegar nelas por discovery.
O fake fica fora do `tsc -b`; recebe apenas `js.configs.recommended` com globais Node no
ESLint e é formatado pelo Prettier.

## Consequências

Positivas:

- Sobe com `node` puro em qualquer Node 22 suportado; nenhuma flag, nenhum `tsx`,
  nenhum passo de build. Um lockfile e um `npm install` para SPA e fake.
- O `id_token` do fake tem a mesma forma do real (claims no token, RS256, `iss` com
  `/o`), então a etapa 3 e os e2e testam o caminho que a produção vai usar.
- Divergências deliberadas (rotas default, sem `end_session_endpoint`) policiam I5 e o
  plano §2.4 em dev: hardcode de caminho ou logout inexistente quebra antes de chegar ao
  back-end real.

Negativas:

- A fidelidade ao IdP real é mantida à mão em meia dúzia de opções; se o
  `monolito-idp` mudar (habilitar logout, mudar claims), o fake passa e a produção falha.
  A etapa 9 do plano existe para isso.
- Porta, `client_id` e `redirect_uri` estão duplicados entre `server.js` e
  `.env.example`; mudar um exige mudar o outro.
- O `sub` não é um literal fixo; e2e e testes manuais precisam digitar o mesmo login.
- `oidc-provider` e `express` entram no `npm install` do build da Vercel sem serem
  usados lá.
- O fake não serve páginas de conta (`VITE_IDP_ACCOUNT_URL` aponta para 404 em dev).
- O fake é *same-site* com a SPA (`localhost:5173` × `localhost:9000`): é cross-origin, mas o
  cookie de sessão do IdP viaja normalmente entre os dois. Em produção (Vercel × Render) é
  cross-site e o cookie não viaja. Qualquer mecanismo de sessão que dependa desse cookie —
  `signinSilent` em iframe com `prompt=none`, por exemplo — passa em dev e falha em produção;
  o fake não policia esse acoplamento, que é justamente o que define o modelo do projeto
  (`docs/backend-mapa-comportamento.md`). A decisão do plano §7.2 deve ser tomada sabendo disso.

## Alternativas consideradas

- **Fake em TypeScript rodado por `node --experimental-strip-types` ou `tsx`** —
  tipos no fake. Descartado: flag ou ferramenta extra, e o arquivo ainda ficaria fora do
  `tsc -b`; I7 governa a SPA, não uma fixture.
- **`package.json` próprio em `dev/idp-fake/` (ou workspace)** — isola dependências.
  Descartado: segundo `npm install`, lockfile a mais (contra a ADR 0001), nenhum ganho em
  um sandbox.
- **Montar `/o` com `http.createServer` reescrevendo `req.url`** — zero dependências.
  Descartado: mesmo comportamento que o `express`, mas com um truque que exige comentário;
  `express` é a receita documentada do `oidc-provider`.
- **Gerar a chave com `jose`** — como o plano sugeria. Descartado: `node:crypto` gera o
  mesmo JWK sem dependência; `jose` só entra na SPA se o §7.1 aprovar.
- **Reproduzir as rotas do IdP real (`/authorize/`, `/userinfo/`)** — logs mais
  familiares. Descartado: esconderia um hardcode de caminho na SPA até a etapa 9.
