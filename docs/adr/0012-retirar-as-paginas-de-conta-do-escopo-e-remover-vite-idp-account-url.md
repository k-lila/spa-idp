# 0012. Retirar as páginas de conta do escopo da SPA e remover `VITE_IDP_ACCOUNT_URL` (emenda a D2)

## Status

Aceito — 2026-09-16

## Contexto

D2 (`docs/spa-nucleo.md` §5; `docs/plano-pre-implementacao.md` §2, §3, §4 e §7.3; `CLAUDE.md`)
fixou a gestão de conta como "linkada às páginas server-side do IdP": um link "Registrar-se" na
landing e um "Editar perfil" em `/app`, ambos com base em `VITE_IDP_ACCOUNT_URL`, lida e exigida
no boot por `src/config.ts` (ADR 0005). Os caminhos finais ficaram como decisão pendente (§7.3),
e o `.env.example`, o `playwright.config.ts` e os fakes de config dos testes carregam um
placeholder que o fake não serve (ADR 0004, consequência negativa: 404 em dev).

O IdP decidiu não ter cadastro nem edição de perfil nesta fase (`nova_api/docs/contrato-backend.md`
§5.4 e §8; ADR do IdP "sem páginas de conta nesta fase", pendente lá): contas continuam criadas
pelo admin, e cadastro público num IdP exposto exige antes validadores de senha, limite de taxa e
verificação de e-mail. O `contrato-frontend.md` §5.3 pede à SPA que retire a dependência.

Do lado da SPA: nenhum módulo de produção lê `config.idpAccountUrl`; os links nunca foram criados
(etapas 1–7 do plano, todas fechadas); a variável obrigatória força um valor fictício em todo
ambiente, inclusive no painel da Vercel (apontado nas TASK-002 e TASK-006). As ADRs 0004 e 0005
mencionam a variável e são imutáveis.

## Decisão

Vamos emendar D2: nesta fase a SPA **não oferece gestão de conta** — nem própria, nem por link ao
IdP. "Registrar-se" e "Editar perfil" saem do plano §2; o §7.3 fica fechado.

Vamos **remover** `VITE_IDP_ACCOUNT_URL`, não torná-la opcional: some de `src/config.ts`,
`src/vite-env.d.ts`, `.env.example`, `playwright.config.ts` e dos fakes de config em
`src/config.test.ts`, `src/auth/userManager.test.ts` e `src/auth/userManager.lib.test.ts`.
`config` passa a expor só `oidc.{issuer, clientId, redirectUri, scope}`; as variáveis obrigatórias
no boot passam a ser três.

A ADR 0005 continua valendo integralmente (ponto único de leitura, falha no boot, sem default, sem
zod); só a contagem "quatro variáveis" e a menção a `idpAccountUrl` ficam defasadas. A
consequência negativa da ADR 0004 sobre o 404 das páginas de conta deixa de existir. Nenhuma das
duas é substituída por esta ADR.

Contraparte: ADR do IdP "sem páginas de conta nesta fase" e `contrato-backend.md` §5.4. Nenhuma
mudança de código, `Application`, CORS ou claim no IdP decorre daqui.

## Consequências

Positivas:

- Nenhum placeholder de configuração em dev, e2e ou Vercel; `config.ts` não valida o que ninguém
  usa.
- `config.test.ts` (14 → 11 casos) e os `fakeConfig` dos testes de `userManager` ficam enxutos
  antes de o passo 2 (`jose`) tocá-los de novo.
- Plano, `CLAUDE.md` e contrato do front-end passam a dizer o mesmo que o `contrato-backend.md`.
- A restrição de `spa-nucleo.md` §6 ("não chamar a API de conta com o `access_token` da RP") fica
  sem objeto: não há API de conta.

Negativas:

- Se o cadastro público vier, é decisão nova nos dois projetos (ADR cruzada), com reintrodução de
  configuração (variável ou caminho descoberto) e de UI — nada disto fica preparado.
- O plano §2 perde uma funcionalidade que veio da conversa de UX; a landing fica com um único
  botão.
- `docs/spa-nucleo.md` §5 ainda descreve D2 como "aguardar definição do mantenedor" e as ADRs
  0004/0005 seguem citando a variável: quem ler esses textos precisa chegar até esta ADR.

## Alternativas consideradas

- **Tornar a variável opcional** (`optionalUrl`, como o contrato admite) — mantém o ponto de
  encaixe. Descartada: nada a consome; seria configuração morta e o primeiro caso de variável sem
  exigência, contra o espírito da ADR 0005.
- **Manter obrigatória com placeholder** até o IdP ter páginas — zero mudança. Descartada: o IdP
  já decidiu que não terá; o placeholder viraria valor fictício em produção.
- **Gestão de conta dentro da SPA** (a outra metade de D2) — Descartada: o IdP não expõe API de
  conta; a SPA não colhe senha (I8) e não deve usar o `access_token` da RP contra outra audiência
  (I1).
- **Adiar a emenda para quando a ADR do IdP existir** — Descartada: a decisão do IdP já está
  registrada em prosa (`contrato-backend.md` §5.4/§8); esperar mantém os passos 2 e 3 tocando
  testes sujos.
