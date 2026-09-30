# 0014. Manter a sessão no reload por redirect ao IdP e SSO, sem token fora da memória, e fechar o plano §7.2

## Status

Aceito — 2026-09-16

## Contexto

O plano §7.2 deixou "sessão no reload" em aberto. `restoreSession()` nasceu como ponto de encaixe
(ADR 0006): consulta só o `userStore` em memória e, após reload, responde `null`; a rota protegida
dispara o redirect ao IdP (I8, ADR 0010) e o IdP devolve por SSO. O plano listou dois candidatos —
silent auth por `prompt=none` e renovação via back-end com cookie — e deixou a escolha ao
back-end. O `contrato-frontend.md` §5.4 recomenda manter o desenho atual e registrá-lo por ADR.

Fatos do IdP que pesam (`contrato-frontend.md` §1; `docs/contrato-backend.md` do IdP, §2,
§5.3, §5.4): o cookie de sessão viaja na navegação top-level cross-site porque é `SameSite=Lax` —
por default do Django, não por declaração: `SESSION_COOKIE_SAMESITE`, `SESSION_COOKIE_AGE` (14 dias,
não deslizantes) e `SESSION_EXPIRE_AT_BROWSER_CLOSE` não estão no `settings.py` nem em teste; o
DOT devolve um `refresh_token` em toda troca de `code`, e ele não expira
(`REFRESH_TOKEN_EXPIRE_SECONDS` ausente), é rotacionado a cada uso e não é revogado ao desativar
a conta; `access_token` e `id_token` valem 10 h; `/o/authorize/` e `/o/token/` aceitam 120
requisições por minuto por origem de rede (429); o DOT pede consentimento em toda ida a
`/o/authorize/` (`REQUEST_APPROVAL_PROMPT="force"`) e o IdP vai marcar `skip_authorization=True`
na `Application` da SPA; não há `end_session_endpoint` nem check-session.

Restrições acumuladas em `.claude/memory/decisions.md`, todas endereçadas a §7.2: TASK-002 — o
fake é same-site com a SPA, e um `signinSilent`/iframe `prompt=none` passaria em dev e falharia
em produção; TASK-003 — `AuthProvider` chama `restoreSession()` em todo boot, inclusive em
`/callback`, e o `.then(setState)` concorre com `userLoaded`, seguro só porque `getUser()` resolve
em microtask; e `Landing` trata `loading` como `anonymous`, mostrando "Entrar" antes de saber;
TASK-004 A3 e TASK-009 — `removeUser()` e `verifyIdToken` existem só em `completeSignin()`, e
qualquer entrada nova por `_buildUser` (silent, refresh) teria de replicá-los; TASK-005 —
`getUser()` ignora `expires_at`; TASK-006 — com a ADR 0010, toda transição
`authenticated`→`anonymous` com a guarda montada precisa navegar ou emitir erro, senão `/app`
fica em `null`. O timeout de rede que a TASK-006 também registrou é decidido na ADR 0015.

O fake responde instantâneo, nunca pede consentimento depois do primeiro login e só emite
`name: ""` num login especial; nada disto é visível no e2e.

## Decisão

Vamos manter o mecanismo atual e declará-lo o definitivo desta fase: **a sessão no reload é por
redirect ao IdP + SSO**. `restoreSession()` continua sendo `userManager.getUser()` — leitura do
store em memória, sem rede, resolvida em microtask, sem emitir `userLoaded` — e após reload
responde `null`; `RequireAuth` dispara `signin()` na entrada sem sessão e o IdP devolve pelo
cookie de sessão dele. Nenhum token sai da memória (I3): sem `sessionStorage`, sem `signinSilent`,
sem iframe; `automaticSilentRenew`, `monitorSession` e `loadUserInfo` continuam `false`. O
`refresh_token` que o DOT devolve em toda troca de `code` é recebido e fica no `User` em memória
(`InMemoryWebStorage`), mas a SPA nunca o usa: não há renovação silenciosa nem chamada a
`/o/revoke_token/` (ADR 0010). O plano §7.2 fica fechado.

Uma adequação de uma linha acompanha, porque o mecanismo só se sustenta com ela: `Landing`
distingue `loading` de `anonymous` — em `loading` renderiza `null`, o padrão de `RequireAuth` e
`Area`; "Entrar" só aparece quando se sabe que não há sessão. Isto fixa o contrato dos três
estados de `AuthState`: `loading` = ainda não se sabe, nenhuma página decide; `anonymous` =
sabe-se que não há sessão em memória; `authenticated` = claims validadas. O timeout das chamadas
de rede da biblioteca acompanha na ADR 0015.

A ausência de consentimento a cada F5 **não** é garantida pela SPA: depende de
`skip_authorization=True` na `Application` da SPA (`contrato-backend.md` §5.3; ADR do IdP sobre
`skip_authorization`, devida lá, tabela §8). Até lá, ou se a marcação faltar, o reload passa pela
tela de consentimento — um passo a mais no mesmo redirect top-level, sem mudança de código.

Disposição dos itens "adiado p/ §7.2":

- Dissolvidos: TASK-002 (same-site do fake) — não há silent auth para o fake mascarar; TASK-003
  (`restoreSession()` com rede × `userLoaded`) — não há rede, e `Landing` distingue `loading`, o
  que fecha a porta pelos dois lados; TASK-004 A3 e TASK-009 (replicar `verifyIdToken` +
  `removeUser()` em entradas novas) — `completeSignin()` continua a única entrada de identidade.
- Débito aceito: TASK-005/TASK-003 (`getUser()` ignora `expires_at`) — `RequireAuth` admite token
  expirado em memória; o 401 do `userinfo` (ADR 0008) é o detector; a janela é uma aba aberta por
  mais de 10 h sem reload.
- Regra de desenho, permanece: TASK-006 — toda transição `authenticated`→`anonymous` com a guarda
  montada precisa navegar ou emitir erro; a guarda não reage. Hoje as únicas origens de
  `removeUser()` são "Sair" (navega) e `completeSignin()` (só `Callback` montada). O invariante I8
  do núcleo não é reescrito; a leitura operacional da ADR 0010 vale. A corrida "Sair × `userinfo`
  em voo" (TASK-006, QA) não é do mecanismo e permanece adiada.

Limite conhecido: não há estado "pendente" durante o `signin()` — em `anonymous` o botão continua
na tela até o redirect sair ou a chamada rejeitar (fora do escopo desta decisão).

Contraparte: `contrato-backend.md` §5.3 (`skip_authorization`) e §5.4 (`SameSite=Lax`; não mudar
para `Strict`). Nenhuma mudança de código, `Application`, CORS ou claim no IdP decorre daqui. Duas
notas cruzadas ficam devidas ao IdP, na ADR de `skip_authorization`: declarar e testar as três
settings do cookie de sessão, e dar a `REFRESH_TOKEN_EXPIRE_SECONDS` um valor finito.

## Consequências

Positivas:

- Nenhum token fora da memória: nada sobrevive ao fechamento da aba nem fica legível em storage;
  desativar a conta no IdP passa a valer no próximo reload ou na próxima expiração.
- Nenhum módulo novo; `restoreSession()`, `AuthProvider`, `RequireAuth` e `Callback` inalterados;
  as garantias de estado das ADRs 0007 e 0010 continuam válidas sem releitura.
- `Landing` nunca mostra "Entrar" antes de saber; o contrato de `loading` deixa de depender de a
  resposta ser rápida.
- Quatro restrições "adiado p/ §7.2" dissolvidas; as duas que ficam têm nome e detector.

Negativas:

- Todo F5 é uma ida ao IdP: a descoberta duas vezes (em `signinRedirect` e, com o módulo
  renascido, em `signinRedirectCallback`; o DOT não manda `Cache-Control`), `/o/token/`, JWKS e
  OPTIONS + GET de `/o/userinfo/`, mais a navegação a `/o/authorize/` e a volta a `/callback` —
  seis a sete requisições e dois redirects por reload. Conta contra o limitador (120/min por
  origem de rede); um NAT compartilhado com F5 em série pode ver 429, com dois destinos: em
  `/o/token/`, o erro genérico do `Callback`, sem retentativa; em `/o/authorize/`, navegação
  top-level, o JSON do limitador é renderizado pelo navegador na origem do IdP, fora da SPA —
  "Voltar" com bfcache cai em `RequireAuth` com "O login não foi concluído."; sem bfcache,
  recarrega e dispara novo `signin()` (`contrato-frontend.md` §5.5).
- Cada F5 grava no IdP um `AccessToken`, um `RefreshToken` e um `IDToken` novos. O refresh não
  expira, `cleartokens` não recolhe refresh vivos nem os access/id vinculados, e a SPA nunca chama
  `/o/revoke_token/`: as tabelas crescem linearmente com os reloads. A mitigação é do IdP
  (`REFRESH_TOKEN_EXPIRE_SECONDS` finito) — nota cruzada acima.
- O `refresh_token` recebido é perpétuo e fica em memória: um XSS persistente na SPA captura a
  resposta de `/o/token/` no próximo F5 — que, por esta ADR, acontece a cada reload. A diferença
  real para `sessionStorage` é "leitura imediata" contra "captura no próximo reload". Quem a torna
  finita é o IdP, com expiração do refresh e revogação ao desativar a conta.
- Depende do `SameSite=Lax` do IdP, hoje default não declarado nem testado, e de os navegadores
  continuarem a enviá-lo em navegação top-level cross-site. Um endurecimento para `Strict`, ou uma
  mudança de política de navegador, vira senha a cada reload — sem erro em lugar nenhum, nem no
  IdP nem na SPA. Dependência não ancorada; nota cruzada acima.
- Consentimento a cada F5 até `skip_authorization` ser marcado: depende de operação do IdP e é
  invisível no fake.
- `loading` em `Landing` é uma página em branco pelo tempo de commit, paint e efeito de
  `AuthProvider` (`restoreSession()` roda em `useEffect`; só o `getUser()` é microtask). Se um dia
  `restoreSession()` ganhar rede, o branco fica visível: esta ADR fecha essa porta — rede em
  `restoreSession()` exige ADR substituta e um placeholder.
- A sessão morre com a aba e com o reload; recuperação após um crash é reautenticar, transparente
  só enquanto o SSO do IdP funcionar.
- Ficam defasadas, e imutáveis: ADR 0006 ("`restoreSession()` e o `userStore` são o único ponto a
  tocar em §7.2"; "reload apaga a sessão até §7.2"), ADR 0010 (Negativas: "a ADR de §7.2 deve
  tratar isso") e ADR 0013 (Negativas sobre entradas futuras por `_buildUser`). Quem as ler
  precisa chegar até aqui.

## Alternativas consideradas

- **Silent auth por `prompt=none`** (plano §7.2) — em redirect top-level continua sendo uma ida ao
  IdP por reload, com o mesmo custo do SSO e sem tolerar a tela de consentimento (viraria
  `consent_required`); em iframe (`signinSilent`) depende de cookie em contexto de terceiro, que
  os navegadores bloqueiam cross-site e que o fake same-site mascara (TASK-002). Descartada.
- **Renovação via back-end** (cookie HttpOnly + endpoint próprio) — exige cookie cross-site
  (`SameSite=None`) e um endpoint que o IdP não tem, ou um BFF que a SPA não tem. O
  `contrato-backend.md` não prevê nenhum dos dois. Descartada.
- **`sessionStorage` + uso do `refresh_token`** — sobreviveria ao reload sem rede. Descartada:
  viola I3 e deixa o `refresh_token` perpétuo legível no ato por qualquer XSS, sem esperar reload;
  além disso, a entrada por refresh passa por `_buildUser` sem `verifyIdToken` nem `removeUser()`
  (TASK-004 A3, TASK-009), o que exigiria replicar os portões.
- **`localStorage`** — o mesmo, pior: compartilhado entre abas e sobrevive ao fechamento do
  navegador. Descartada.
- **Persistir só `access_token` + `id_token` em `sessionStorage`** (sem refresh) — 10 h de token
  fora da memória, I3 ao pé da letra violado, e `restoreSession()` teria de re-verificar o token
  ao ler. Descartada.
- **Placeholder visível em `loading`** ("Carregando…") — dura um ciclo de render; um flash de
  texto é pior que um frame em branco, e `RequireAuth` já usa `null`. Descartado.
- **Estado "pendente" no botão durante `signin()`** (desabilitar, spinner) — em `loading` o botão
  não existe; durante o `signin()` o redirect normalmente sai em menos de um segundo. Fora do
  escopo; fica como apontamento.
- **Reescrever I8 no núcleo** ("token válido" → "só na entrada") — o núcleo é histórico; a ADR
  0010 já é a leitura operacional e esta ADR a confirma. Descartada.
