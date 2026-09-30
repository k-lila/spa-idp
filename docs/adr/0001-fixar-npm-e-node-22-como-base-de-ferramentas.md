# 0001. Fixar npm e Node 22 LTS como base de ferramentas

## Status

Aceito — 2026-09-14

Revisão — 2026-09-29: referências a documentos de trabalho suprimidas; decisão inalterada (ver índice).

## Contexto

A SPA nasce sem código e sem repositório git. O núcleo (`docs/spa-nucleo.md`) fixa
Vite, React, TypeScript `strict`, ESLint, Prettier, Tailwind e React Router, mas não diz
qual gerenciador de pacotes nem qual versão de Node sustentam esse conjunto. Sem essa
fixação, cada colaborador ou agente escolhe o próprio: aparecem lockfiles concorrentes
(`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`), o CI e a Vercel resolvem versões
diferentes das da máquina de desenvolvimento, e o plano já pressupõe `npm run idp`
para o IdP fake. O Vite 7 exige Node 20.19+ ou 22.12+. A Vercel oferece Node 22 como
runtime de build suportado. O `CLAUDE.md` pede a solução mais simples que funciona.

## Decisão

Vamos usar **npm** como único gerenciador de pacotes, com `package-lock.json` commitado,
e **Node 22 LTS** como runtime, declarado em `.nvmrc` (`22`) e em
`package.json` (`"engines": { "node": ">=22.12" }`). Scripts de projeto são sempre
`npm run <script>`; nenhum outro lockfile entra no repositório.

## Consequências

Positivas:

- Zero ferramenta adicional: npm já vem com o Node; o template do Vite, a Vercel e o CI
  o reconhecem sem configuração.
- Uma versão de Node para dev, CI e Vercel, o que elimina a classe de erro "funciona na
  minha máquina" por diferença de runtime.
- O plano (`npm run idp`) e os scripts de qualidade (`typecheck`, `lint`, `build`)
  ficam com um único prefixo.

Negativas:

- npm é mais lento que pnpm em instalação e usa mais disco (sem store compartilhado);
  irrelevante para um projeto deste tamanho, mas perceptível se crescer.
- Node 22 entra em manutenção em outubro de 2026; migrar para 24 será uma tarefa curta,
  mas terá de ser feita.
- Um segundo gerenciador não pode ser adotado "só para testar": lockfile concorrente é
  proibido por esta ADR.

## Alternativas consideradas

- **pnpm** — mais rápido, `node_modules` estrito e menor. Descartado: acrescenta uma
  instalação global e uma linha em cada ambiente (CI, Vercel `packageManager`), ganho
  irrelevante em um sandbox com poucas dependências.
- **Node 24 (LTS mais recente)** — mais tempo de suporte. Descartado por ora: 22 é o
  mínimo pedido pelo Vite e o runtime de build mais consolidado na Vercel; a troca para
  24 é `.nvmrc` + `engines`, sem impacto no código.
- **Não fixar versão de Node** — cada ambiente usa o que tem. Descartado: é exatamente a
  origem de builds divergentes entre dev e Vercel.
