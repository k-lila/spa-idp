# 0006. Integrar o `oidc-client-ts` v3 por um `UserManager` único, com tokens em memória e estado de redirect em `sessionStorage`

## Status

Aceito — 2026-09-15

## Contexto

O núcleo (`docs/spa-nucleo.md`, §5, D1) deixava aberta a escolha entre `oidc-client-ts` e PKCE
à mão; o plano fixou D1 = `oidc-client-ts`, mas nenhuma ADR registra a decisão nem como a
biblioteca é delimitada dentro da SPA. A etapa 3 do plano (§8) é onde a dependência entra. Os
invariantes impõem tokens só em memória (I3), redirect + PKCE S256 (I2), discovery a partir do
issuer (I5), configuração por `VITE_*` (I6) e guarda por redirect (I8). O plano (§5) sugere a
configuração (`userStore` em memória, `stateStore` no padrão, `automaticSilentRenew: false`,
`loadUserInfo: false`) e deixa abertas duas decisões que tocam a biblioteca: a verificação da
assinatura do `id_token` (§7.1 — a biblioteca não verifica assinatura via JWKS desde a v2) e o
mecanismo de sessão no reload (§7.2). Com o `userStore` em memória, a biblioteca ainda precisa de
um lugar que sobreviva ao redirect top-level para `state`, `nonce` e `code_verifier`, porque a
página é descarregada. Em dev, `<StrictMode>` executa efeitos duas vezes: uma segunda chamada a
`signinRedirectCallback()` não encontra o `state` consumido pela primeira e falha, e um segundo
`signinRedirect()` grava dois `state` e dispara duas navegações. A ADR 0003 veta auth em loaders.

## Decisão

Vamos adotar `oidc-client-ts` v3 e concentrar todo contato com ela em `src/auth/userManager.ts`,
que instancia um único `UserManager` a partir de `config` com: `userStore` =
`WebStorageStateStore` sobre `InMemoryWebStorage` (tokens só em memória, I3); `stateStore` no
padrão da biblioteca (`sessionStorage`), que guarda apenas `state`, `nonce` e `code_verifier`
durante o redirect e os remove no callback; `response_type: "code"` e o `scope` do contrato;
`automaticSilentRenew: false`, `monitorSession: false` e `loadUserInfo: false`. O mesmo módulo
exporta as três operações que a SPA usa — `signin()`, `completeSignin()` e `restoreSession()` —
e memoiza em escopo de módulo as promessas de `signinRedirect` e `signinRedirectCallback`, de
modo que chamadas concorrentes (StrictMode) compartilhem uma única execução. O `AuthProvider`
aprende a identidade pelo evento `userLoaded` do `UserManager`, não por retorno de função.
`restoreSession()` hoje consulta apenas o store em memória: após reload responde "sem sessão" e
a rota protegida volta ao IdP. A verificação da assinatura do `id_token` não é feita nesta etapa;
fica para a decisão §7.1 (etapa 4).

## Consequências

Positivas:

- PKCE, discovery, troca de `code` e conferência de `state` ficam na biblioteca; o código de auth
  da SPA são quatro arquivos pequenos.
- I3 fica garantido por configuração: nenhuma chave `oidc.user:*` em Local/Session Storage; o
  que fica no `sessionStorage` durante o redirect não contém token.
- `restoreSession()` e o `userStore` são o único ponto a tocar quando §7.2 for decidido;
  `signinSilent` já existe na biblioteca se a decisão for silent auth.
- StrictMode continua ligado e `state` continua estrito (I2); a deduplicação é em código nosso,
  não em configuração relaxada.
- Os eventos do `UserManager` cobrem "Sair" (etapa 6: `removeUser` → `userUnloaded`) sem novo
  encanamento.

Negativas:

- Enquanto §7.1 não for decidido, o `id_token` é aceito sem verificar assinatura; a confiança vem
  do `state`, do PKCE e do TLS do token endpoint. Não se deve presumir que a biblioteca confere
  `iss`, `aud`, `exp` e `nonce` do `id_token` — isso precisa ser confirmado no código instalado ao
  decidir §7.1. I4 fica declaradamente pendente.
- Reload apaga a sessão: um redirect ao IdP a cada F5, até §7.2.
- O tipo `User` da biblioteca chega às páginas (`user.profile`); a etapa 4 decide se o contexto
  passa a carregar claims validadas por zod.
- Memoização em escopo de módulo é estado global; funciona porque todo fluxo de redirect é um
  carregamento de página novo. Um segundo `completeSignin()` na mesma vida do módulo devolve o
  mesmo resultado.
- A biblioteca usa `crypto.subtle` para o PKCE: só roda em contexto seguro (`https` ou
  `localhost`); um IP de rede local sobre `http` não autentica.
- O `refresh_token` fica em memória com o resto; com `automaticSilentRenew: false` nunca é usado
  nesta etapa, mas está lá.

## Alternativas consideradas

- **PKCE à mão** (D1) — mais código, demonstra o protocolo. Descartado pelo plano; num sandbox o
  fluxo já demonstra o protocolo sem reimplementá-lo.
- **`react-oidc-context`** — provider pronto sobre `oidc-client-ts`. Descartado: esconde o
  `UserManager`, processa o callback automaticamente (dificulta o ponto de encaixe
  `restoreSession` e o controle do StrictMode) e é uma dependência a mais para trinta linhas.
- **`stateStore` em memória** — I3 ao pé da letra. Descartado: a página é descarregada no
  redirect; o `code_verifier` se perderia e o callback nunca fecharia.
- **Callback em `loader` do React Router** — executa uma vez, imune ao StrictMode. Descartado:
  contraria a ADR 0003 (nada de auth em loaders) e tira o estado "autenticando" do componente.
- **Desligar StrictMode ou tolerar `state` ausente** — descartado: perde o detector de efeitos
  impuros e relaxa I2.
