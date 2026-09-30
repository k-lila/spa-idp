# 0016. Publicar a SPA na Vercel com `vercel.json`, variáveis por ambiente no painel e previews sem IdP de produção

## Status

Aceito — 2026-09-17

## Contexto

A SPA é a relying party (RP) do IdP (Identity Provider) e vive em origem diferente
dele: Vercel de um lado, AWS do outro (`contrato-frontend.md` §1 e §6.2). Até aqui o repositório
não tem nada de deploy — nem `vercel.json`, nem `.github/` — e o "typecheck/lint/test antes do
deploy" de `docs/spa-nucleo.md` §4 existe só como scripts do `package.json`.

Cinco fatos moldam a publicação:

- `/callback` é rota do React Router, não arquivo em `dist/`. A Vercel serve o sistema de
  arquivos primeiro; sem um rewrite, o redirect do IdP para `https://<spa>/callback?code=…&state=…`
  recebe 404 e o `code` (60 s) morre. Hash router não é alternativa: a RFC 6749 §3.1.2 proíbe
  fragmento na `redirect_uri`. A URL de `/callback` carrega `code` e `state`, e qualquer recurso
  externo carregado por aquela página receberia a URL inteira no `Referer`.
- I6 (`docs/spa-nucleo.md`) exige que issuer, `client_id` e `redirect_uri` venham de `VITE_*` e
  nunca do código; `src/config.ts` lança no boot quando uma falta (ADR 0005). A build
  (`tsc -b && vite build`) não executa `config.ts`: um deploy sem variáveis publica, mas a
  aplicação não sobe. Um `.env.production` commitado seria carregado por todo build da Vercel,
  inclusive previews.
- Cada preview da Vercel tem origem própria em `*.vercel.app`, domínio compartilhado por todos os
  usuários da plataforma. O IdP compara a origem do CORS (Cross-Origin Resource Sharing) e a
  `redirect_uri` por igualdade exata (`docs/contrato-backend.md` do IdP, §5.1 e §5.2); a
  allowlist governa `/o/token/` e `/o/userinfo/` — descoberta e JWKS saem com `*` do próprio
  `django-oauth-toolkit` (ADR 0013).
- A Vercel não lê `.nvmrc`; lê `engines.node` do `package.json` e usa a maior versão disponível
  que satisfaça o range. Com `>=22.13`, o build pode correr em Node 24, que nenhum teste
  exercitou (`.claude/memory/decisions.md`, TASK-001). A ADR 0001 fixa Node 22 LTS.
- O contrato §6.2 pede `typecheck`, `lint` e `test` como gate do deploy de produção, e produção
  só a partir da `main`. Nenhum dos dois se expressa no repositório: a integração Git da Vercel
  publica a cada push, e o gate vive na branch protection do GitHub e na branch de produção do
  projeto Vercel. O e2e (Playwright) baixa o Chromium a cada execução e sobe fake e Vite; o
  contrato exige só os três comandos.

## Decisão

Vamos publicar a SPA na Vercel com quatro peças no repositório e três fora dele.

No repositório:

1. `vercel.json` com rewrite universal para `/index.html` e, em toda rota, os cabeçalhos
   `Referrer-Policy: no-referrer` e `X-Content-Type-Options: nosniff` — o literal de
   `contrato-frontend.md` §5.2. Nada além disso: sem `routes`, sem `builds`, sem `Cache-Control`.
2. `engines.node` em `package.json` apertado para `>=22.13 <23`: é o campo que a Vercel lê, e o
   teto exclui o 24. `.nvmrc` continua `22`. A ADR 0001 segue valendo — Node 22 LTS; só a forma
   do range muda.
3. `.github/workflows/ci.yml` com um job `ci` que roda `npm ci`, `typecheck`, `lint`,
   `format:check` e `test` em push na `main` e em pull request, em Node lido de `.nvmrc`, com
   cache do npm. Sem variáveis `VITE_*` no workflow; sem e2e.
4. README com o que fica fora do repositório (abaixo), o contexto seguro e a regra dos previews.

Fora do repositório — configuração externa, registrada aqui porque não há onde versioná-la:

- Variáveis `VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID` e `VITE_OIDC_REDIRECT_URI` no painel da
  Vercel, por ambiente. Production: os valores do IdP de produção (issuer na forma da ADR 0017).
  Preview: nenhuma — o preview publica e `config.ts` lança no boot; é o comportamento desejado
  enquanto não houver cliente de preview. Development: os do IdP local. Nunca o mesmo valor em
  dois ambientes; nunca `.env.production` no repositório. O formulário de variáveis do painel
  marca os três ambientes por padrão: desmarcar Preview ao cadastrar os valores de produção.
- Previews não autenticam. Se um dia for necessário, a SPA entrega ao IdP um alias estável
  (branch domain ou domínio próprio de preview), que ganha a terceira `Application` e a terceira
  entrada de CORS. Nunca regex `*.vercel.app`.
- Gate: branch protection na `main` exigindo o check `ci` (nome do job), com o bypass de
  administrador desligado, e branch de produção = `main` no projeto Vercel. O gate só existe
  pelo caminho do pull request: num push direto à `main` — o fluxo deste repositório até aqui —
  a integração Git da Vercel publica no push e o CI roda depois, como aviso, não como barreira.
  O workflow dá o sinal; o gate é ligado no painel e só vale se o trabalho passar por PR. O
  campo "Node.js Version" do painel fica em 22.x, redundante com `engines`.

Contraparte: `contrato-backend.md` §5.2 (CORS por origem exata; previews fora) e a ADR do IdP
"CORS por origem exata; previews da Vercel fora", devida lá (tabela §8), que pode citar esta por
número. Nenhuma mudança de código, `Application` ou CORS no IdP decorre daqui.
`Referrer-Policy: no-referrer` suprime o `Referer` nos `fetch` a `/o/token/` e `/o/userinfo/`, e
nada no IdP depende dele: o token endpoint é `csrf_exempt` e o `userinfo` é `GET`; o cabeçalho
`Origin`, que o CORS usa, continua sendo enviado.

## Consequências

Positivas:

- `https://<spa>/callback` carregado diretamente responde a SPA; a URL com `code` não vaza em
  `Referer`.
- Build da Vercel, CI e dev no mesmo major de Node; a mudança para o 24 passa a exigir editar
  `engines`, em vez de acontecer por default.
- Quem lê o repositório sabe o que está no painel (README e esta ADR), mesmo sem acesso a ele.
- O CI roda sem segredo nem variável: um teste que dependa de `.env.local` quebra no CI — é o
  que se quer.

Negativas:

- Metade da configuração de deploy vive fora do git (painel da Vercel, branch protection) e pode
  divergir sem diff; a única conferência é o passo 6 de `docs/implementacao-contrato.md`.
- Previews inúteis para testar login; toda verificação contra o IdP real é local (passo 5) ou em
  produção (passo 6).
- e2e fora do CI: uma regressão que só o redirect real revela chega à `main` se ninguém rodou
  `npm run test:e2e` antes do PR.
- `engines <23` faz `npm install` avisar `EBADENGINE` em máquinas com Node 23 ou 24 (aviso, não
  erro; `.nvmrc` com `nvm use` resolve).
- Levar Node 22 para 24 (manutenção em outubro de 2026, ADR 0001) toca `engines`, `.nvmrc` e o
  painel.
- Nenhum cabeçalho além dos dois: CSP fica fora; o `Cache-Control` do documento é o default da
  Vercel, a conferir no passo 6 pelo bfcache (ADR 0010).
- `contrato-frontend.md` §6.2 e `implementacao-contrato.md` passo 4b dizem que "a build falha"
  sem variáveis; a build passa e a aplicação lança no boot. O efeito é o mesmo; a frase fica
  imprecisa até a próxima edição do contrato.
- O gate de CI é condicional ao fluxo: enquanto os commits forem empurrados direto à `main`, um
  `typecheck` vermelho vai ao ar antes de o CI reportar. Trabalhar por PR é o que ativa a
  barreira; deploy pelo próprio workflow (`vercel deploy --prebuilt --prod` após os testes) foi
  considerado e descartado por exigir segredos no GitHub — reabrir se o fluxo por PR não pegar.

## Alternativas consideradas

- **Hash router em vez de rewrite** — dispensaria `vercel.json`. Descartado: a RFC 6749 §3.1.2
  proíbe fragmento na `redirect_uri`.
- **Fixar Node só no painel da Vercel** — invisível no git, e `engines >=22.13` continuaria
  permitindo o 24 se alguém mudasse o painel. Descartado como mecanismo principal; fica como
  redundância.
- **`engines: "22.x"`** — inclui 22.0–22.12, abaixo do piso do eslint@10 (TASK-001). Descartado.
- **e2e no CI** — Chromium a cada execução, fake e dois servidores, para três comandos que o
  contrato exige. Descartado; local antes do PR. Reabrir se uma regressão de redirect escapar.
- **Variáveis `VITE_*` no workflow** — fariam passar um teste acoplado ao ambiente. Descartado.
- **`.env.production` commitado** — viola I6 e seria carregado pelos previews. Descartado.
- **Cliente de preview no IdP agora** — sem alias estável não há origem a registrar. Adiado.
- **Regex `*.vercel.app` no CORS do IdP** — domínio compartilhado por todos os usuários da
  Vercel; qualquer deploy alheio viraria origem aceita. Descartado.
- **Gate por script ("Ignored Build Step") consultando o CI** — mais peças que um required check
  na branch protection. Descartado.
