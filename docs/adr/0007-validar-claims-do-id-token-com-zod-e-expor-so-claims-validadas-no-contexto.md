# 0007. Validar as claims do `id_token` com zod em dois portões e expor ao contexto só claims validadas

## Status

Aceito — 2026-09-15

Revisão — 2026-09-29: referências a documentos de trabalho suprimidas; decisão inalterada (ver índice).

## Contexto

I7 exige que dados que cruzam a borda sejam validados em runtime; a integração do `oidc-client-ts` entregou a identidade
às páginas pelo tipo estático `User.profile` do `oidc-client-ts`, sem validar nada. A ADR 0006
deixou explicitamente para depois decidir se o contexto passa a carregar claims validadas. O
contrato confirmado com o mantenedor é: `sub` e `email` string não vazia (`email` é o
identificador de login no IdP); `name` string, podendo ser vazia (vem de `get_full_name()`, que
devolve `""` para usuário sem nome cadastrado); `email_verified` não existe; claims extras
(`iat`, `exp`, `auth_time`, `sid`, `at_hash`, desconhecidas) são toleradas; formato de e-mail não
é checado.

Há uma restrição de ordem imposta pela biblioteca: em `signinRedirectCallback()`, o `UserManager`
grava o `User` no `userStore` e dispara `userLoaded` **antes** de a promessa resolver. O
`AuthProvider` aprende a identidade por esse evento (ADR 0006). Em `/callback` só `<Callback/>`
está montada, então a janela não é uma navegação imediata: é o estado ficar `authenticated` com a
identidade rejeitada e ninguém ouvir `userUnloaded` para desfazê-lo — o clique em "Voltar ao
início" cairia na `Landing`, que redirecionaria a `/app`, e a área renderizaria a identidade
rejeitada. O critério de aceite exige que isso nunca aconteça e que, após a rejeição, nenhum token
da tentativa fique em memória (I3). A verificação de assinatura está fora desta decisão.

## Decisão

Vamos declarar o contrato das claims em `src/auth/claims.ts` como um `z.object` com `sub` e
`email` em `z.string().min(1)` e `name` em `z.string()`, e derivar o tipo `Claims` dele. Chaves
desconhecidas são descartadas, não rejeitadas. O mesmo schema é aplicado em dois portões
distintos: (1) no `AuthProvider`, uma função `toState(user: User | null): AuthState` converte
tanto o `userLoaded` quanto o retorno de `restoreSession()` em estado — só claims aceitas viram
`authenticated`; qualquer outra coisa vira `anonymous`; (2) em `completeSignin()`, dentro da
promessa memoizada, o resultado de `signinRedirectCallback()` é validado; em falha, a função chama
`userManager.removeUser()` para descartar os tokens da tentativa e rejeita com o `ZodError`, que a
`/callback` registra no console e converte no estado de erro já existente. A variante
`authenticated` do `AuthState` passa a carregar `claims: Claims` no lugar de `user: User`; as
páginas deixam de ver o `User` da biblioteca e, com ele, os tokens. `restoreSession()` mantém a
assinatura (`User | null`) até a decisão sobre a sessão no reload.

## Consequências

Positivas:

- Não existe estado `authenticated` observável com identidade rejeitada: o portão (1) é o único
  caminho para o estado React e ele só aceita claims válidas.
- Tokens de uma tentativa rejeitada são removidos pela operação pública da biblioteca; `/app`
  volta a redirecionar ao IdP (I8) e a landing volta a mostrar "Entrar".
- Todos os erros do callback (state, code, rede, claims) caem na mesma rejeição; a UI de erro não
  precisa distinguir causas.
- O contrato de identidade fica explícito, tipado e num arquivo só; `userinfo` e o
  retorno de `restoreSession()`, depois da decisão sobre a sessão no reload, reutilizam o mesmo schema.
- `oidc-client-ts` deixa de ser importado em `AuthContext.ts`.

Negativas:

- O schema roda duas vezes por login sobre o mesmo objeto (handler e `completeSignin`). Aceito: é
  uma função pura sobre três strings; a alternativa exige um emitter próprio.
- `sub` ausente ou vazio é rejeitado pela própria biblioteca antes do zod; a causa no console
  difere, o estado de erro é o mesmo.
- `min(1)` não faz `trim`: `"   "` é aceito. O contrato diz "não vazia", não "não branca".
- `name` ausente ainda rejeita (a chave precisa existir, mesmo vazia); `email` vazio rejeita. Isso
  acopla a SPA ao modelo de usuário do IdP: se o back-end passar a omitir a chave `name` ou a
  permitir e-mail em branco, o login falha de forma ruidosa e o schema precisa acompanhar.
- `removeUser()` emite `userUnloaded`, que ninguém ouve ainda; o `AuthProvider` fica `anonymous`
  pelo portão (1), não pelo evento.

## Alternativas consideradas

- **Validar só em `Callback.tsx`, após `completeSignin()`** — o lugar óbvio. Descartado: chega
  depois do `userLoaded`; o estado já seria `authenticated` sem nada que o desfizesse, e "Voltar ao
  início" levaria a `/app` com a identidade rejeitada.
- **Validar só no handler de `userLoaded` e lançar, contando que `Event.raise` propaga a exceção
  até `signinRedirectCallback`** — um portão só. Descartado: depende de comportamento interno não
  documentado da biblioteca e deixaria o token no store.
- **Substituir o evento da biblioteca por um emitter próprio alimentado por
  `completeSignin()`/`restoreSession()`** — um único parse. Descartado: mais código, supersede a
  ADR 0006, e o ganho é evitar um `safeParse` de três strings.
- **Manter `user: User` no contexto e acrescentar `claims`** — menor diff em `AuthContext`.
  Descartado: mantém tokens ao alcance das páginas sem necessidade.
- **`z.strictObject`** — rejeita chaves extras. Descartado: quebra o login com `iat`, `exp`, `sid`
  etc. (AC-05).
