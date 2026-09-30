# 0005. Validar as variáveis `VITE_*` no boot em `src/config.ts`, sem zod

## Status

Aceito — 2026-09-15

Revisão — 2026-09-29: referências a documentos de trabalho suprimidas; decisão inalterada (ver índice).

## Contexto

I6 exige que `issuer`, `client_id` e `redirect_uri` venham de variáveis de ambiente
`VITE_*` e nunca sejam fixados no código. O plano acrescenta `VITE_IDP_ACCOUNT_URL`
e pede que a falta de variável falhe no boot, não na primeira chamada, e sugere zod para
isso. O Vite substitui `import.meta.env.VITE_X` estaticamente e tipa tudo como `any`; sem
um ponto único de leitura, cada módulo leria a variável por conta própria, com fallback
("`?? "http://localhost:9000/o"`") que viola I6 silenciosamente. O zod entra no projeto com a
validação das claims, e o `CLAUDE.md` pede a solução mais simples que funciona.

## Decisão

Vamos concentrar toda leitura de `import.meta.env` em `src/config.ts`. O módulo lê as
quatro variáveis por acesso estático, exige string não vazia (e URL válida para as três
que são URL) por meio de duas funções locais, e lança `Error` nomeando a variável
faltante no topo do módulo — a aplicação não renderiza. Exporta um único objeto
`config` (`as const`) com `oidc.{issuer, clientId, redirectUri, scope}` e
`idpAccountUrl`; `scope` é constante do contrato (`openid profile email`), não variável de
ambiente. `src/vite-env.d.ts` declara as quatro variáveis como `string | undefined`.
`main.tsx` importa `config` antes de `createRoot`. Não usaremos zod para configuração,
nem agora nem na validação das claims: zod fica reservado para dados que cruzam a rede (I7). Nenhuma
variável recebe valor default. `.env.example` é commitado com os valores do fake;
`.env.local` é o arquivo de trabalho e é ignorado pelo git.

## Consequências

Positivas:

- Uma variável faltando aparece como uma linha de erro com o nome dela, no boot, em dev
  e em preview da Vercel — não como um redirect para `undefined/.well-known/...`.
- Só um arquivo conhece `import.meta.env`; o `userManager` e os módulos seguintes
  consomem `config` tipado.
- Sem dependência e sem schema para três strings; a decisão sobre zod nas claims não
  precisa revisitar este arquivo.

Negativas:

- Falha de boot é tela em branco com erro no console; não há tela de erro amigável
  para configuração ausente. Aceito: é erro de deploy, não de usuário.
- Validação de URL é sintática; um issuer com barra final ou host errado só aparece no
  discovery.
- O texto do plano que menciona zod para `config.ts` fica desatualizado.

## Alternativas consideradas

- **Schema zod em `config.ts`** — como o plano sugeria. Descartado: adianta a
  dependência uma etapa para validar três strings estáticas; o ganho é nulo e o zod tem
  papel claro na borda de rede.
- **Leitura direta de `import.meta.env` onde for usada** — menos indireção. Descartado:
  multiplica pontos de leitura, convida a fallbacks e adia a falha para a primeira
  chamada.
- **Default para o fake quando a variável falta** — zero configuração em dev.
  Descartado: é hardcode de issuer/client (I6) e esconde erro de ambiente em preview.
