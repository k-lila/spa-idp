# 0002. Adotar Tailwind CSS v4 pelo plugin oficial do Vite

## Status

Aceito — 2026-09-14

## Contexto

O núcleo (`docs/spa-nucleo.md`, §4) fixa Tailwind como base de estilo e shadcn/ui (Radix)
como primitivos de UI acessíveis, sem dizer a versão. Existem duas linhas ativas:

- **v3**: configuração em `tailwind.config.js` (com `content: []` apontando para os
  arquivos a varrer), integração por PostCSS (`postcss.config.js`, `autoprefixer`),
  diretivas `@tailwind base/components/utilities`.
- **v4**: configuração em CSS (`@import "tailwindcss"`, `@theme`), detecção automática de
  classes, plugin `@tailwindcss/vite` que dispensa PostCSS e `autoprefixer`, engine
  reescrita (mais rápida). Exige browsers modernos (Safari 16.4+, Chrome 111+,
  Firefox 128+). shadcn/ui suporta v4 desde o início de 2025.

O `CLAUDE.md` pede a solução mais simples que funciona; o scaffold é o momento em que a
escolha custa zero, e a troca depois custa reescrever tema e configuração.

## Decisão

Vamos usar **Tailwind CSS v4** integrado pelo plugin **`@tailwindcss/vite`**. A única
configuração é `@import "tailwindcss";` em `src/index.css`; tema, se vier a existir, entra
por `@theme` no mesmo arquivo. Não haverá `tailwind.config.*` nem `postcss.config.*`.

## Consequências

Positivas:

- Dois arquivos de configuração a menos e duas dependências a menos (`postcss`,
  `autoprefixer`); o scaffold fica com um plugin no `vite.config.ts` e uma linha de CSS.
- Detecção automática de classes: não há `content` para esquecer de atualizar quando
  `src/pages/` ou `src/auth/` ganharem arquivos.
- shadcn/ui, quando entrar (§4 do núcleo), inicializa nativamente sobre v4.

Negativas:

- Grande parte dos exemplos e respostas na internet ainda descreve a v3; quem copiar
  `tailwind.config.js` de um tutorial não vai encontrar efeito.
- Requisito de browsers modernos: não há suporte a Safari < 16.4 nem a Chrome < 111.
  Para uma SPA de estudo em 2026, aceitável; para produto com base antiga, não seria.
- Plugins de terceiros escritos para a v3 podem não funcionar; nenhum está previsto.

## Alternativas consideradas

- **Tailwind v3 com PostCSS** — caminho mais documentado. Descartado: mais arquivos,
  mais dependências e `content` manual, sem nenhum ganho para este projeto; migrar para
  v4 depois custaria reescrever a configuração que se acabou de criar.
- **Tailwind v4 via PostCSS (`@tailwindcss/postcss`)** — mesmo Tailwind, integração
  genérica. Descartado: o projeto é Vite; o plugin oficial é mais rápido e elimina o
  `postcss.config.*`.
- **CSS Modules sem Tailwind** — descartado: contraria o núcleo e inviabiliza shadcn/ui.
