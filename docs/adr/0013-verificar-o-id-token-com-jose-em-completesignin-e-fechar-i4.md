# 0013. Verificar o `id_token` com `jose` em `completeSignin()` — assinatura via `jwks_uri`, `iss` exato, `aud`, RS256 e `exp` — e dar I4 por cumprido

## Status

Aceito — 2026-09-16

Revisão — 2026-09-29: referências a documentos de trabalho suprimidas; decisão inalterada (ver índice).

## Contexto

O invariante I4 (`docs/spa-nucleo.md` §2) exige que o `id_token` seja validado antes de ser
confiado: assinatura via JWKS (RS256), `iss` = `{issuer}`, `aud` = `client_id`, `exp`, `nonce`.
`oidc-client-ts` 3.5.0 valida só `sub` e `nonce` (fato verificado na TASK-003 e registrado nas
Negativas da ADR 0006): não verifica assinatura, `iss`, `aud` nem `exp`. Desde a integração do `oidc-client-ts` o token
entra em `/app` com a confiança vinda apenas do `state`, do PKCE e do TLS do token endpoint; um
token forjado, de outro issuer, para outro `client_id`, com `alg` trocado ou expirado seria
renderizado. O plano deixou duas opções — acrescentar `jose` ou relaxar I4 por ADR — e o
acordo entre os projetos recomendou a primeira.

O IdP publica o necessário (`docs/integracao-rp.md` do IdP): `id_token` RS256 com `kid` no
cabeçalho casando com a única chave RSA do `jwks_uri` anunciado na descoberta; `iss` igual ao
issuer por igualdade exata de string (sem normalizar barra final); `aud` contendo o `client_id`;
`exp`. Na descoberta e no `jwks_uri` o próprio `django-oauth-toolkit` emite
`Access-Control-Allow-Origin: *` (`views/oidc.py`), independente da allowlist
`CORS_ALLOWED_ORIGINS`, que governa `/o/token/` e `/o/userinfo/`.
O JWKS é público e alcançável de qualquer origem. O DOT também o serve com
`Cache-Control: public, max-age=3600, stale-while-revalidate=3600`; o fake de `dev/idp-fake/`
não envia `Cache-Control`, então o comportamento com cache HTTP nunca é exercitado pelo e2e.

Duas restrições já existentes moldam o encaixe. (1) Ordem dos eventos (ADR 0007): dentro de
`signinRedirectCallback()` a lib grava o `User` e dispara `userLoaded` antes de a promessa
resolver; qualquer verificação posterior deixa o estado `authenticated` por um instante, e a
rejeição precisa passar por `removeUser()` para desfazê-lo e para não deixar tokens em memória
(I3). (2) Contexto seguro (ADR 0006): a lib já usa `crypto.subtle` para o PKCE, então a SPA só
autentica em `https` ou `localhost`.

## Decisão

Vamos verificar o `id_token` com `jose` (v6, ESM, Web Crypto; `^6.2.12` em `dependencies`) em
`completeSignin()`, dentro da promessa memoizada, **antes** da validação zod das claims, e dar
I4 por cumprido; a questão da verificação da assinatura fica fechada.

`jose` fica confinado a `src/auth/idToken.ts`, pelo mesmo princípio da ADR 0006 para
`oidc-client-ts`. O módulo exporta `verifyIdToken(idToken, getKey): Promise<void>` — um
`jwtVerify` com `issuer: config.oidc.issuer`, `audience: config.oidc.clientId`,
`algorithms: ["RS256"]`, `requiredClaims: ["exp"]` e `clockTolerance: 60` — e
`remoteJwks(jwksUri)`, que devolve `createRemoteJWKSet(new URL(jwksUri))`. `completeSignin()`
obtém o `jwks_uri` por `userManager.metadataService.getKeysEndpoint(false)` (I5: da descoberta,
já em cache pelo próprio callback) e chama `verifyIdToken(user.id_token, remoteJwks(jwksUri))`.
Falha em qualquer ponto — assinatura, `kid` desconhecido, `iss`, `aud`, `alg`, `exp`, JWKS
inacessível, `jwks_uri` ausente — segue o caminho da ADR 0007: `await userManager.removeUser()`
e rejeição com o erro original; `Callback` mostra o estado de erro já existente.

Detalhes que importam:

- `iss` é comparado com `VITE_OIDC_ISSUER`, não com o `issuer` da descoberta: a configuração é
  a âncora de confiança, e comparar com o que o documento afirma seria circular. Barra final na
  variável passa a rejeitar todo token.
- O payload verificado é descartado (`void`). A identidade continua saindo de `user.profile` —
  a mesma string `user.id_token` que a lib decodificou — validada pelo zod nos dois portões da
  ADR 0007. Não há segundo parse nem segunda fonte de identidade.
- `nonce` e `sub` continuam com a biblioteca; a SPA não os reimplementa.
- `clockTolerance` de 60 s: cobre desvio de relógio de dispositivo sem NTP e é desprezível
  diante dos 36 000 s de vida do token. Não reaproveita `clockSkewInSeconds` (300 s), que a lib
  aplica ao `expires_at` do `access_token`.
- `requiredClaims: ["exp"]` porque `jose` só valida `exp` quando presente; sem isso "exp no
  futuro" seria condicional.
- `getKey` é parâmetro obrigatório de `verifyIdToken`, não de `completeSignin()`: a API usada
  por `Callback` não muda e nenhum chamador pode omitir a fonte de chave. Nos testes, a
  criptografia é exercitada com `createLocalJWKSet` em ambiente `node`; a orquestração de
  `completeSignin()` substitui `./idToken` por módulo.

Contraparte: `integracao-rp.md`; ADRs
0004 (RS256, chave com `kid`) e 0007 (issuer `{BASE_URL}/o`) do IdP. Nenhuma mudança de código,
`Application`, CORS ou claim no IdP decorre daqui.

## Consequências

Positivas:

- I4 cumprido: token forjado, de outro issuer, para outro `client_id`, com `alg` trocado ou
  expirado nunca vira identidade; o zod só roda sobre um token cuja origem foi provada.
- Mesmo caminho de rejeição da ADR 0007: nada novo em `Callback`, `AuthProvider` ou contexto;
  mensagem única mantida; nenhum token da tentativa fica em memória.
- A busca do JWKS tem timeout próprio do `jose` (5 s): JWKS pendurado falha em tempo finito,
  independente do `requestTimeoutInSeconds`.
- Os e2e T-03 e T-05 passam a exercitar a verificação real (RS256 do `oidc-provider`); o T-03
  observa a requisição ao `jwks_uri`.
- `jose` isolado num módulo de duas funções; `userManager.ts` continua o único ponto de contato
  com `oidc-client-ts`.

Negativas:

- Uma requisição a mais por login, cross-origin, ao `jwks_uri` (`GET` simples, sem preflight;
  CORS `*` emitido pelo DOT). Uma falha de rede nesse caminho chega como `TypeError` e cai na
  mensagem genérica.
- A SPA **não** sobrevive à rotação da chave do IdP dentro da janela de cache HTTP. O reload
  por `kid` desconhecido do `createRemoteJWKSet` é inerte aqui: a instância é nova por login,
  o primeiro `fetch` marca o JWKS como fresco e o `cooldownDuration` (30 s) bloqueia a
  releitura; e mesmo uma releitura bateria no cache HTTP do navegador, que guarda o JWKS
  antigo por `max-age=3600` (+ `stale-while-revalidate`). Após uma rotação, quem obteve o JWKS
  na hora anterior falha todo login com a mensagem genérica (`JWKSNoMatchingKey` no console)
  por até 1–2 h. Saídas possíveis, a decidir em tarefa própria: (a) na SPA, `fetch` próprio
  com `cache: "no-store"` pelo símbolo `customFetch` do `jose`; (b) no IdP, procedimento de
  rotação que publique a chave nova em `OIDC_RSA_PRIVATE_KEYS_INACTIVE` por pelo menos
  `OIDC_JWKS_MAX_AGE_SECONDS` antes de ativá-la (nota cruzada para o IdP).
- A janela em que `AuthProvider` está `authenticated` com identidade ainda não verificada passa
  de uma microtask a uma requisição de rede. Continua inofensiva pelo mesmo motivo da ADR 0007
  (em `/callback` só `Callback` está montada; `removeUser()` emite `userUnloaded`), mas cresce. A
  restrição de desenho da TASK-006 (toda transição `authenticated`→`anonymous` com a guarda
  montada precisa navegar ou emitir erro) continua valendo para a sessão no reload.
- A verificação cobre só `completeSignin()`. Qualquer entrada futura por `_buildUser`
  (`signinSilent`, refresh com `id_token` novo) grava token e emite `userLoaded` sem
  passar por aqui; precisa replicar `verifyIdToken` + `removeUser()` (tech-debt TASK-004 A3).
- `VITE_OIDC_ISSUER` com barra final falha só no callback, com a mensagem genérica; a causa
  aparece só no console (`unexpected "iss" claim value`). Rejeitar no boot em `config.ts` seria
  mais claro — fica como apontamento, fora desta decisão.
- Contexto seguro (`https` ou `localhost`) ganha uma segunda razão além do PKCE; `http://<ip>`
  continua sem autenticar. Não é restrição nova.
- Duas bibliotecas decodificam o mesmo token (a lib para `profile`, `jose` para verificar). A
  coerência depende de `User.id_token` ser a string que a lib decodificou — verdade em 3.5.0.
- Versão literal (`^6.2.12`) e `clockTolerance` literal (60 s) nesta ADR; mudança de major ou
  de tolerância por outra razão exige ADR nova.
- `at_hash` não é verificado por ninguém; não faz parte de I4 e é opcional no code flow.

## Alternativas consideradas

- **Relaxar I4 por ADR** (a segunda opção do plano) — OIDC Core §3.1.3.7 permite dispensar a
  assinatura quando o token vem por TLS direto do token endpoint. Descartada: transfere toda a
  confiança para DNS + CA + `VITE_OIDC_ISSUER` e deixa `iss`, `aud` e `exp` sem verificação
  nenhuma, pelo custo da mesma chamada que verifica tudo.
- **Fazer `oidc-client-ts` verificar** — a lib não tem gancho de validação de assinatura desde
  a v2; seria fork ou patch. Descartada: código fora do nosso controle, atualização travada.
- **Verificar num back-end próprio (BFF)** — a SPA não tem servidor; o token endpoint é chamado
  do navegador (I2, I3). Descartada: cria componente novo só para isto.
- **`metadataService.getSigningKeys()` + `createLocalJWKSet`** — reaproveita o fetch da lib (e o
  `requestTimeoutInSeconds`). Descartada: não recarrega ao ver `kid` desconhecido,
  exige cast do tipo `SigningKey` da lib para JWK, e diverge do acordo entre os projetos.
- **Comparar `iss` com `metadataService.getIssuer()`** — toleraria a barra final. Descartada:
  circular; a configuração é a âncora de confiança.
- **`getKey` como parâmetro com default em `completeSignin()`** — testabilidade direta.
  Descartada: abre na API pública um caminho para substituir a fonte de chave; o parâmetro fica
  na função interna, sem default.
- **Stubar `fetch` global nos testes em vez de injetar `getKey`** — exercitaria
  `createRemoteJWKSet` real. Descartada: `jose` é externalizado pelo Vitest (não renasce com
  `vi.resetModules()`), e o teste ficaria acoplado ao transporte interno da biblioteca. O trecho
  remoto é provado pelo e2e T-03.
- **Reaproveitar `clockSkewInSeconds` (300 s)** — um número só. Descartada: é configuração de
  outra biblioteca para outro campo, e 5x maior do que o necessário.
- **Verificar depois do zod** — Descartada: parsear claims de um token cuja origem não foi
  provada inverte a ordem de confiança.
