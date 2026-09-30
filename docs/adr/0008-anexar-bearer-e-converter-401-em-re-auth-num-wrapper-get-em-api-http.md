# 0008. Anexar o Bearer e converter 401 em re-auth num wrapper GET-only em `src/api/http.ts`, mantendo a requisição pendente e com guarda de uma re-auth por aba

## Status

Aceito — 2026-09-15

Revisão — 2026-09-29: referências a documentos de trabalho suprimidas; decisão inalterada (ver índice).

## Contexto

O núcleo (`docs/spa-nucleo.md`, §3) prevê um "wrapper de `fetch`" que anexa `Bearer` e trata
`401` com re-autenticação; é aqui que ele entra, tendo o `userinfo` como
único consumidor. Até aqui o `access_token` nunca foi usado: fica no `userStore` em memória
(ADR 0006) e as páginas só veem claims validadas (ADR 0007). Três restrições moldam o wrapper.
I1 diz que o token da RP só lê identidade — nunca escreve no diretório de usuários. Ninguém
ouve `userUnloaded` (TASK-004), então "limpar o token e esperar reação" não redireciona nada; a
re-auth precisa passar por `signin()`, que já memoiza a promessa de `signinRedirect()` — e essa
promessa, no `oidc-client-ts` 3.5, só resolve em `pageshow`, ou seja, permanece pendente até a
página ser descarregada. Por fim, se o IdP emitir um token novo que o `userinfo` continua
recusando (audiência, escopo ou relógio errados — cenário plausível contra o IdP
real), `/app → IdP → /callback → /app → 401` vira um laço rápido e silencioso, porque o SSO do
IdP não pede senha; a memoização em escopo de módulo não atravessa carregamentos de página.
O critério de aceite exige exatamente um redirect por 401, sem mensagem de erro nem retentativa.

## Decisão

Vamos criar `src/api/http.ts` exportando `authGet(url): Promise<Response>` e a classe
`UnauthorizedError`. `authGet` lê o `User` de `userManager.getUser()` dentro do módulo, anexa
`Authorization: Bearer <access_token>` e faz apenas `GET` — não recebe `RequestInit`, de modo que
escrever com o token da RP exige alterar o wrapper (I1 estrutural). Sem sessão em memória, lança
`UnauthorizedError` sem redirecionar: "sem sessão" é assunto da guarda de rota (I8), não do IdP.
Em `401`, o wrapper consulta um marcador em `sessionStorage` (`spa.reauth`, valor `"1"`, não é
token): se o marcador existe, lança `UnauthorizedError` sem redirecionar — é o segundo `401`
consecutivo e o laço é cortado; se não existe, grava o marcador e faz `await signin()`, o que
mantém a requisição pendente até o unload; o `throw` que segue só executa se a página voltar
por bfcache. Qualquer resposta que não seja `401` remove o marcador e é devolvida como está.
O tipo `User` e o token não saem do módulo.

## Consequências

Positivas:

- Um só gatilho de redirect por `401`, garantido pela promessa pendente de `signin()`: refetch
  concorrente, StrictMode ou retentativa não conseguem disparar segunda navegação na mesma página.
- Não existe estado de erro nem tela intermediária entre o `401` e o IdP: a consulta fica em
  `pending`, a seção mantém o indicador de carregamento e a página é descarregada.
- O laço de re-auth para no segundo `401` da aba e vira falha visível na seção `userinfo`, em vez
  de um flicker infinito difícil de diagnosticar.
- `access_token` continua confinado: `userManager.ts` o guarda, `http.ts` o lê; páginas e hooks
  recebem `Response` ou `Claims`.
- A política é independente do recurso: o `userinfo` é o primeiro consumidor, não um caso especial.

Negativas:

- Uma promessa deliberadamente pendente é um padrão incomum; depende do fato de que `signin()`
  descarrega a página. Se o fluxo virar popup/iframe (já registrado como risco na ADR 0006),
  `authGet` passa a pendurar consultas indefinidamente.
- O marcador em `sessionStorage` é um segundo estado fora do React (o primeiro é o `stateStore`
  da biblioteca). Efeito colateral conhecido: voltar do IdP por bfcache após um `401` deixa o
  marcador gravado; o refetch seguinte mostra falha em vez de redirecionar, até um `F5` (que
  reinicia a sessão em memória e passa pela guarda de rota). Soma-se ao tech-debt de bfcache do
  "Sair".
- O caminho "segundo `401`" não é provocável contra o fake (chave e store são recriados juntos);
  fica coberto só por teste unitário.
- `403` e demais status não são interpretados: caem na falha genérica do consumidor.

## Alternativas consideradas

- **Lançar `UnauthorizedError` imediatamente após disparar `signin()`** — deixa a consulta em
  erro antes de a navegação começar (`signinRedirect` tem `await`s internos antes do
  `location.assign`), e a mensagem de falha aparece durante o carregamento do IdP. Descartada:
  viola "sem mensagem de erro" e obriga a página a distinguir "redirecionando" de "falha".
- **`removeUser()` e confiar na reação do `AuthProvider`** — ninguém ouve `userUnloaded` e o
  estado ficaria `authenticated` com token morto. Descartada.
- **Sem guarda de laço, tech-debt para depois** — menos código hoje. Descartada: o laço só
  aparece contra o IdP real, e é o pior modo de falha para diagnosticar (cada volta
  é uma navegação completa; o console se perde). O custo da guarda são três linhas.
- **Guarda em memória (variável de módulo)** — não sobrevive ao redirect; inútil por definição.
- **Wrapper genérico com `RequestInit`** — mais flexível. Descartado: o único consumidor é um
  `GET`, e a assinatura GET-only expressa I1 no tipo.
- **Função específica `fetchUserinfo` sem wrapper** — menos um arquivo. Descartada: mistura
  política de credencial (Bearer, `401`) com contrato do recurso (endpoint, schema, `sub`), e o
  núcleo já nomeia o wrapper como camada própria.
