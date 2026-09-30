# 0011. Levar o destino do deep-link no `state` do `signinRedirect` e aceitar no callback só caminho da própria origem, resolvido por `URL`

## Status

Aceito — 2026-09-16

Revisão — 2026-09-29: referências a documentos de trabalho suprimidas; decisão inalterada (ver índice).

## Contexto

O plano prevê que a rota protegida sem sessão guarde o destino no `state` do redirect e o
callback o restaure; hoje `Callback` navega para `/app` fixo e `completeSignin()` descarta
`user.state` (TASK-004, A4). O destino atravessa um redirect top-level, logo precisa de um lugar
fora da memória; há dois candidatos: o `state` da própria biblioteca (gravado em `sessionStorage`
sob `oidc.<state>`, removido pela lib ao processar o callback, atado ao pedido de autorização) ou
uma chave própria em `sessionStorage`. O valor restaurado é `unknown` e controlável por quem escreva
no `sessionStorage` da aba; se virar navegação sem checagem, é redirecionamento aberto. Um detalhe
do `react-router` agrava o risco: quando `pushState` lança (URL de outra origem), `history.push`
cai em `window.location.assign(url)` — valores como `//host` ou `/\host` (o parser de URL trata
`\` como `/`) passam por uma checagem de prefixo `"/"` e saem da origem. Só `RequireAuth` grava
destino; `Landing` e a re-auth por 401 (`api/http.ts`) não têm destino e devem cair em `/app`.

## Decisão

Vamos passar o destino pelo `state` do `signinRedirect`: `signin(returnTo?: string)` envia
`state: { returnTo }` quando há destino, e nada quando não há. `completeSignin()` passa a resolver
`{ claims, returnTo }`, onde `returnTo` é sempre um caminho da própria origem: uma função privada
`internalPath(user.state)` extrai `returnTo` se for string, resolve `new URL(raw,
window.location.origin)`, exige `origin` igual ao da SPA e devolve `pathname + search + hash`;
qualquer outra coisa (ausente, não string, outra origem, `//host`, `/\host`, esquema, malformada)
devolve `/app`. `Callback` navega para `returnTo` com `replace`. `RequireAuth` envia
`pathname + search + hash` de `useLocation()`; `Landing` e `http.ts` chamam `signin()` sem destino.
A primeira chamada memoizada de `signin()` define o destino (StrictMode repete o mesmo valor).

## Consequências

Positivas:

- Nenhuma chave nova fora do React: o `stateStore` já existente carrega o destino e o apaga no
  callback; não há resíduo entre tentativas.
- O que chega ao `navigate()` é sempre uma URL que `pushState` aceita; o fallback do `react-router`
  para `location.assign` nunca é atingido por valor de `state`.
- `/callback` continua fora do histórico (`replace`), e `/` → Entrar → `/app` fica idêntico ao que
  era (AC-07).
- A política de "caminho interno" fica ao lado de quem lê `user.state`, num único lugar.

Negativas:

- `userManager.ts` passa a ler `window.location.origin`; testes unitários que exercitam
  `internalPath` precisam de `jsdom`.
- A re-auth por 401 volta a `/app` sem query string: `http.ts` não conhece a rota. Aceito; `/app` é
  a única rota protegida.
- O formato de retorno de `completeSignin()` muda (`{ claims, returnTo }`); o teste T-03(b) que o
  fixa precisa ser reaberto.

## Alternativas consideradas

- **Chave própria em `sessionStorage`** — mais simples de ler no callback. Descartada: terceiro
  estado fora do React (depois do `stateStore` e de `spa.reauth`), não atado ao pedido de
  autorização, fica órfã em login abandonado.
- **Validar por prefixo (`startsWith("/") && !startsWith("//")`)** — sem `URL`. Descartada: deixa
  passar `/\host`, que o navegador resolve como `//host` e o `react-router` entrega a
  `location.assign`.
- **Manter `/app` fixo** — sem deep-link. Descartada: o plano e AC-06 exigem o destino.
