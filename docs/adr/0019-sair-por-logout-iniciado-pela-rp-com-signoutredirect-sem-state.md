# 0019. Sair por logout iniciado pela RP com `signoutRedirect()` sem `state`, mantendo a guarda disparada só na entrada sem sessão

## Status

Aceito — 2026-09-29

## Contexto

Pela ADR 0010, "Sair" só esquecia os tokens em memória (`removeUser()`). A sessão Django do IdP
seguia viva, o "Entrar" seguinte voltava sem senha pelo SSO e o `access_token` valia até expirar
(10 h). A ADR 0029 do `nova_api` liga o logout iniciado pela RP (_OpenID Connect RP-Initiated
Logout 1.0_). A descoberta passa a publicar `end_session_endpoint`. Com `id_token_hint` vivo do
usuário da sessão, o IdP não pede confirmação, revoga os tokens do usuário **só na Application que
pediu**, encerra a sessão e redireciona só a um `post_logout_redirect_uri` cadastrado. Pede
confirmação quando o hint falta, é de outra conta ou já não tem linha no banco — por exemplo, um
hint do mesmo usuário já revogado por um logout em outra aba.

Do lado da SPA, `signoutRedirect()` do `oidc-client-ts` chama `removeUser()` (e portanto
`userUnloaded`) **antes** de ler o `end_session_endpoint` da descoberta. Quando a descoberta falha
ou não traz o endpoint, a sessão local já foi esquecida. `RequireAuth`, com a trava `hadSession`,
renderiza `null`, e nenhuma mensagem em `/app` chegaria a aparecer. A lib só grava estado de logout
e envia `?state=` quando recebe `state`. A promessa de `signoutRedirect()` só resolve se a página
voltar do IdP pelo bfcache.

O fake (ADR 0004) desligava `rpInitiatedLogout` porque o IdP real não o anunciava. Com ele ligado,
o `oidc-provider` pede confirmação sempre que há sessão, mesmo com hint válido, o que diverge do
IdP real.

## Decisão

Vamos fazer "Sair" ir ao `end_session_endpoint` anunciado na descoberta, por
`userManager.signoutRedirect()` **sem `state`**. O `post_logout_redirect_uri` vem da variável
obrigatória `VITE_OIDC_POST_LOGOUT_REDIRECT_URI`, validada no boot como as demais (ADR 0005). O
valor é a landing `/`, idêntico ao cadastrado no IdP.

- **Volta:** GET simples à landing. A `Landing` não chama `signoutRedirectCallback()`, não lê
  parâmetros e nada fica no `sessionStorage`.
- **Falha dentro da página** (`signoutRedirect()` rejeita; na prática, descoberta sem
  `end_session_endpoint`, porque ela fica em cache desde o `/callback`): a lib já descartou os tokens e o
  cache de `userinfo` (`userUnloaded`). O botão navega para `/` com o estado de navegação
  `{ signoutFailed: true }`, e a `Landing` mostra, em `role="alert"`, que não foi possível encerrar
  a sessão no provedor de identidade.
- **Volta pelo bfcache** (`signoutRedirect()` resolve): `signout()` recarrega a página, para a
  guarda remontar sem sessão e ir ao IdP.
- **Mantido da ADR 0010, que esta substitui:** o handler de `userUnloaded` só atualiza estado e
  chama `queryClient.clear()`, e nunca navega. `RequireAuth` só dispara `signin()` na entrada sem
  sessão (`useRef` `hadSession`). Quem provoca a perda da sessão é quem navega: o IdP no sucesso, o
  botão na falha.
- **Fake:** `rpInitiatedLogout` ligado, com `post_logout_redirect_uris` do `spa-local` apontando
  para a landing local. Um `logoutSource` submete a confirmação sozinho (`logout=yes`) quando o
  `sub` do hint é o da sessão, e mostra a confirmação nos demais casos. Isso emenda a cláusula
  "`rpInitiatedLogout` desligado" da ADR 0004. O princípio dela, o fake espelhar o contrato que a
  SPA consome, é justamente o que exige a mudança.

Contraparte: ADR 0029 do `nova_api`
([`../../../nova_api/docs/adr/0029-ligar-o-logout-iniciado-pela-rp-com-revogacao-restrita-a-application.md`](../../../nova_api/docs/adr/0029-ligar-o-logout-iniciado-pela-rp-com-revogacao-restrita-a-application.md)).

## Consequências

Positivas:

- "Sair" encerra a sessão do IdP e invalida os tokens emitidos. "Entrar" e "Voltar" depois de sair
  pedem credenciais.
- O I5 fica preservado: nenhuma URL de logout é fixada, e o fake publica o endpoint noutro caminho
  (`/o/session/end`), o que denuncia qualquer valor fixado no código.
- Sem `state`, não há estado de logout para guardar, conferir ou limpar, e a landing não ganha
  código.
- A falha dentro da página é visível e deixa a SPA sem tokens em memória: nunca tela em branco.

Negativas:

- "Sair" passa a depender de rede e do IdP. Se falhar, a sessão do IdP pode continuar viva; o
  alerta, quando aparece, diz isso, mas não resolve.
- A ordem de implantação é obrigatória: IdP, depois o cadastro do destino, depois a variável na
  Vercel, e só então a SPA. A variável nova derruba o boot de todo ambiente que não a tiver.
- A correção da falha depende da ordem interna da lib (`removeUser()` antes da descoberta). O teste
  com a lib real fixa essa ordem.
- **O alerta só cobre a rejeição dentro da página.** Falhas depois de a página sair para o IdP —
  IdP desligado (página de erro da Cloudflare, ADR 0018), destino não cadastrado ou com barra
  divergente (400), chave de assinatura trocada (400) — a SPA não enxerga. Os tokens locais já foram
  descartados, a sessão Django pode continuar viva e, com "Voltar", o reload do bfcache leva a
  guarda ao IdP, e o SSO devolve a pessoa logada sem senha. Aceito conscientemente, sem código.
- `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` tem de ser idêntica, byte a byte, ao cadastro no IdP, com a
  barra final. O boot não detecta a diferença, e o erro só aparece como 400 no primeiro "Sair".
- A revogação feita pelo IdP alcança só os tokens do usuário na Application da SPA; as outras RPs
  mantêm os seus, mas perdem a volta sem senha, porque a sessão do IdP termina inteira (ADR 0029).
- No fake, o logout passa por uma página HTML de auto-submissão que cria entrada de histórico. O
  real responde 302 e não cria.
- O fake compara só o `sub` do hint com o `accountId` da sessão. O real exige também que a linha do
  `id_token` ainda exista e pergunta se não existir (ADR 0029, "Hint sem linha"). O caso "hint
  revogado com sessão nova" (duas abas) não é reproduzido pelo fake, e os e2e não o cobrem.
- Verificar em dev contra o IdP real local depende de o IdP aceitar destino `http://localhost`.

## Alternativas consideradas

- **Enviar `state` e chamar `signoutRedirectCallback()` na landing** — nada precisa atravessar o
  logout, e isso poria estado no `sessionStorage` e código de callback numa rota pública.
  Descartada.
- **Mostrar a falha em `/app` ou em `RequireAuth`** — `/app` já está desmontada quando a lib
  rejeita, e ensinar a guarda a exibir erro de logout mistura responsabilidades. Descartada.
- **Consultar `end_session_endpoint` antes de chamar `signoutRedirect()`** — o AC-06 exige
  descartar os tokens mesmo na falha, então a navegação para a landing continuaria necessária. É
  código a mais para o mesmo resultado. Descartada.
- **`redirectMethod: "replace"`** — tira `/app` do histórico, e "Voltar" cairia numa tela vencida
  do IdP em vez de passar pela guarda. Descartada.
- **`revokeTokensOnSignout`** — o IdP já revoga no logout. Exigiria `revocation_endpoint` com CORS
  para a SPA. Descartada.
- **Substituir a ADR 0004 inteira** — o resto da decisão sobre o fake continua válido. Só a cláusula
  do logout muda, e ela é registrada aqui. Descartada.
- **Substituir só a parte "Sair local" da ADR 0010** — o status de ADR não tem substituição
  parcial. A 0010 fica substituída por inteiro, e as regras que continuam valendo foram repetidas
  acima. Escolhida esta forma.
