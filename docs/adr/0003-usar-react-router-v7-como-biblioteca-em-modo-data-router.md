# 0003. Usar React Router v7 como biblioteca, em modo data router

## Status

Aceito — 2026-09-14

## Contexto

O núcleo (`docs/spa-nucleo.md`, §3) fixa React Router para rota de callback, guarda de
rota por redirect (I8) e deep-link. O React Router v7 oferece três modos:

- **declarativo**: `<BrowserRouter>` + `<Routes>`/`<Route>` em JSX; sem `errorElement`
  por rota, sem loaders.
- **data router**: `createBrowserRouter` + `<RouterProvider>`; rotas como objetos, com
  `errorElement`, loaders e actions opcionais. Continua sendo uma biblioteca dentro de um
  app Vite comum.
- **framework mode**: `@react-router/dev` substitui a configuração do Vite, traz rotas
  por convenção de arquivos, SSR por padrão e um servidor próprio.

A SPA é uma Relying Party OIDC com tokens **exclusivamente em memória** (I3) e deploy
estático na Vercel. Qualquer camada servidor no front (SSR, loaders executando no servidor)
cria a tentação de mover tokens ou sessão para fora do browser e muda o modelo de deploy.
Ao mesmo tempo, o plano (§2) prevê estados de erro no callback e um `NotFound`, e o
núcleo (§4) pede Error Boundary; `errorElement` por rota entrega isso sem componente
extra. O pacote `react-router-dom` na v7 é só um reexport de `react-router`.

## Decisão

Vamos usar o pacote **`react-router`** (v7) **como biblioteca**, em **modo data router**:
`createBrowserRouter` em `src/router.tsx`, exportando o objeto `router`, montado por
`<RouterProvider>` em `src/main.tsx`. Não usaremos `@react-router/dev`, framework mode
nem SSR. `react-router-dom` não entra nas dependências. Loaders e actions ficam
permitidos, mas nada de auth passa por eles: a guarda de rota é componente
(`RequireAuth`, I8), lendo o contexto de auth, como o plano (§5) descreve.

## Consequências

Positivas:

- O projeto continua um app Vite estático: `vite build` gera `dist/`, a Vercel serve
  arquivos; nenhum runtime de servidor entra no front.
- `errorElement` por rota cobre o Error Boundary pedido pelo núcleo sem biblioteca extra.
- `router.tsx` como objeto puro permite que `AuthProvider` envolva o `RouterProvider`
  sem que o router dependa de auth — `RequireAuth` lê o contexto por baixo.
- Um único pacote de roteamento; sem confusão entre `react-router` e `react-router-dom`.

Negativas:

- Rotas como objetos são um pouco menos legíveis que JSX para quem vem do v5/v6
  declarativo; mitigado pela lista curta (`/`, `/callback`, `/app`, `*`).
- Renunciamos ao framework mode e, com ele, a rotas por arquivo, SSR e prerender. Se um
  dia a SPA precisar de SEO ou de renderização no servidor, será outra arquitetura — e
  outra ADR.
- Deep-link em produção depende de rewrite para `index.html` na Vercel (`vercel.json`),
  como em qualquer SPA; isso é da etapa de deploy e não vem de graça com este modo.

## Alternativas consideradas

- **Modo declarativo (`<BrowserRouter>`)** — mais simples de ler. Descartado: sem
  `errorElement` teríamos de escrever um Error Boundary próprio; e a migração para data
  router depois toca em todas as rotas.
- **Framework mode (`@react-router/dev`)** — rotas por arquivo, SSR. Descartado:
  introduz servidor no front, contraria o deploy estático e cria pressão para tirar
  tokens da memória (I3). Custo alto para um ganho que este projeto não pede.
- **TanStack Router** — tipagem de rotas superior. Descartado: contraria o núcleo, que
  fixa React Router, e o ganho de tipos não compensa numa árvore de quatro rotas.
