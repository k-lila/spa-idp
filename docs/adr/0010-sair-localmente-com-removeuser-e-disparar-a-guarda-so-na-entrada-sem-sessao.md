# 0010. Sair localmente com `removeUser()` e disparar a guarda de rota só na entrada sem sessão, nunca na perda de sessão com a guarda montada

## Status

Aceito — 2026-09-16

## Contexto

O plano (§2.4) define "Sair" como esquecer os tokens e navegar para `/`, com aviso de que a sessão
no IdP continua viva enquanto não houver `end_session_endpoint` (§9). A ADR 0006 previu o mecanismo
(`removeUser()` → `userUnloaded`); a ADR 0009 exige que o cache do `userinfo` morra com os tokens
(`queryClient.clear()`, provider acima do `AuthProvider`); a TASK-004 fixou que o handler de
`userUnloaded` só atualiza estado, porque `completeSignin()` também chama `removeUser()` ao rejeitar
claims e uma navegação no handler apagaria a tela de erro de `/callback`. Duas guardas reagem ao
estado: `RequireAuth` dispara `signin()` quando vê `anonymous` (I8) e `Landing` redireciona a `/app`
quando vê `authenticated`. Se o estado vira `anonymous` com `RequireAuth` montada em `/app`, ela manda
o usuário ao IdP, que por SSO o devolve logado — "Sair" viraria um piscar de tela. Se a navegação
para `/` acontece antes de esquecer a sessão, `Landing` vê `authenticated` e devolve a `/app`. E a
ordem entre os dois não pode ser garantida por sequenciamento no botão: o `RouterProvider` de
`react-router` envolve toda navegação em `React.startTransition`, então um `setState` em lane default
(o do handler, disparado fora de evento React) renderiza antes de a rota commitar; `flushSync` só
existe em `react-router/dom`, e mesmo com ele o bounce de `Landing` persiste.

## Decisão

Vamos expor `signout()` em `src/auth/userManager.ts` (`userManager.removeUser()`, sem rede) e no
contexto de auth. O `AuthProvider` passa a ouvir `userUnloaded` e, nele, faz apenas duas coisas:
`setState({ status: "anonymous" })` e `queryClient.clear()` (via `useQueryClient()`); nunca navega.
O botão "Sair" em `Area` executa, nesta ordem: `await signout()` e só então `navigate("/")`.
`RequireAuth` passa a disparar `signin()` **só na entrada sem sessão**: um `useRef` marca que a
guarda chegou a hospedar `authenticated`, e a partir daí a transição para `anonymous` nesta mesma
montagem renderiza `null` sem redirecionar — quem provocou a perda (o botão) é quem navega. Uma
nova montagem da guarda (voltar a `/app` depois de sair) tem ref zerado e volta a exigir o IdP.

## Consequências

Positivas:

- Não existe janela em que a guarda chame `signin()` durante "Sair": o único caminho até `signin()`
  exige que a guarda nunca tenha visto sessão nesta montagem. Independe de lanes, transições e
  microtasks.
- `Landing` nunca recebe `authenticated` no fim de "Sair": o estado `anonymous` já está commitado
  quando a transição de rota renderiza.
- O handler continua "só estado", como a TASK-004 exige; a rejeição de claims em `/callback` segue
  mostrando o erro.
- Cache de identidade e tokens morrem juntos, no mesmo evento, em qualquer origem de `removeUser()`.
- "Sair" não depende de rede nem do IdP; funciona com o fake derrubado.

Negativas:

- "Perda de sessão com a guarda montada" vira `null` silencioso: se §7.2 (renovação silenciosa) ou
  outro mecanismo passar a chamar `removeUser()` sem navegar, `/app` fica em branco. Quem remove a
  sessão fora de "Sair" precisa navegar ou emitir estado de erro; a ADR de §7.2 deve tratar isso.
- A distinção "entrada × perda" fica num `useRef` dentro de `RequireAuth`, não no `AuthState`; é
  local e invisível para quem lê só o contexto.
- Logout é só local: "Voltar" do navegador depois de sair remonta a guarda, vai ao IdP e o SSO
  devolve o usuário logado sem senha. O aviso ao lado do botão descreve isso; não é bug.

## Alternativas consideradas

- **Navegar para `/` antes de `removeUser()`** — `Landing` vê `authenticated` e redireciona a
  `/app`; a corrida com o `userUnloaded` reabre o bounce ao IdP. Descartada.
- **Estado intermediário `signing-out` + `navigate(..., { flushSync: true })`** — exige
  `RouterProvider` de `react-router/dom`, uma API de signout em duas fases (estado neutro, navegar,
  descartar) e ainda depende de o estado neutro durar exatamente até o commit da rota. Mais peças
  para o mesmo efeito. Descartada.
- **Status `signed-out` que a guarda ignora** — ao voltar a `/app` a guarda montaria com
  `signed-out` e não redirecionaria: caminho morto. Descartada.
- **Navegar no handler de `userUnloaded`** — desmonta `Callback` na rejeição de claims e apaga o
  erro; vetado pela TASK-004. Descartada.
- **`window.location.assign("/")` (reload como logout)** — sem corrida alguma, mas não exercita o
  modelo de estado (tokens somem por acidente, não por decisão), e com §7.2 um reload passa a
  restaurar a sessão, o que faria "Sair" deixar de sair. Descartada.
