# 0015. Fixar `requestTimeoutInSeconds` em 15 s no `UserManager`

## Status

Aceito — 2026-09-17

## Contexto

O item 7 da verificação (`contrato-frontend.md` §7) exige que o login falhe em tempo finito. Sem
`requestTimeoutInSeconds`, o `fetch` da biblioteca não rejeita sozinho: um IdP adormecido (cold
start no Render/AWS) ou uma rede que engole a resposta pendura `signin()` sem feedback, e o
segundo clique em "Entrar" devolve a mesma promessa memoizada (TASK-006). A ADR 0014 multiplica
as idas ao IdP — toda entrada sem sessão e todo reload passam pela descoberta e por `/o/token/` —
e com isso o custo de uma espera infinita.

O que a biblioteca entrega: `fetchWithTimeout` cancela o timer quando o `fetch` resolve, isto é,
quando chegam os cabeçalhos; `response.json()` corre depois, sem abort. Com o Django, que não faz
streaming, cabeçalhos e corpo chegam juntos e não há cenário real em que isso importe — mas o
timeout cobre a resposta até os cabeçalhos, não "aborta em 15 s" no sentido pleno.

## Decisão

Vamos fixar `requestTimeoutInSeconds: 15` no `UserManager` (`src/auth/userManager.ts`).

Cobre as chamadas de rede da biblioteca — a descoberta, em `signinRedirect` e em
`signinRedirectCallback`, e `/o/token/` — até os cabeçalhos da resposta. Rejeição na descoberta
cai em `Landing`/`RequireAuth` ("Não foi possível iniciar o login."), com retentativa por clique;
rejeição em `/o/token/` cai em `Callback` ("Não foi possível concluir a autenticação.", "Voltar
ao início"), porque `code` e `state` já foram consumidos. `silentRequestTimeoutInSeconds` herda
15 por fallback da biblioteca; inerte enquanto não houver silent renew.

Não cobre: a busca do JWKS pelo `jose` (timeout próprio de 5 s, ADR 0013) nem `authGet`
(`src/api/http.ts`), que não tem timeout além do do navegador.

O valor: um cold start atinge a descoberta, onde a rejeição é barata e o botão retenta;
`/o/token/` roda com o IdP quente, porque a pessoa acabou de logar nele. 10 s seria aceitável;
30 s é longo demais sem feedback.

## Consequências

Positivas:

- Falha em tempo finito nos três pontos de contato com o IdP (landing, guarda, callback), com
  retentativa por clique onde ela é possível; o item 7 do contrato §7 fecha.

Negativas:

- No pior caso são 15 s sem feedback: não há estado "pendente" no botão durante o `signin()`
  (fora do escopo; ADR 0014).
- O timeout pode derrubar um login válido se `/o/token/` demorar mais que isso (banco frio na
  AWS): o sinal é o erro do callback com `ErrorTimeout` no console logo após um login que
  funcionou no IdP. Sem retentativa no callback; novo login do zero.
- O literal fica nesta ADR; retune com evidência dos passos 5 e 6 é ADR nova que substitui esta.

## Alternativas consideradas

- **Sem timeout** (estado anterior) — IdP lento pendura o clique para sempre e o item 7 do
  contrato §7 não fecha. Descartada.
- **10 s** — aceitável; fica como piso se a evidência dos passos 5 e 6 pedir ajuste. Descartado
  por ora.
- **30 s** — longo demais sem feedback. Descartado.
