# 0009. Consumir o `userinfo` com TanStack Query v5, chaveado pelo `sub` do `id_token` e validado pelo schema de claims

## Status

Aceito — 2026-09-15

## Contexto

O núcleo (`docs/spa-nucleo.md`, §3) fixa TanStack Query como camada de estado de servidor, com
`userinfo` como primeiro caso; a etapa 5 do plano (§8) a introduz. `loadUserInfo` está em `false`
no `UserManager` (ADR 0006) de propósito: a identidade do `id_token` chega pelo contexto, e o
`userinfo` deve ser uma chamada própria, visível no DevTools, que prove o `access_token` contra um
recurso protegido cross-origin. I5 exige o endpoint vindo do discovery; I7 exige validar o corpo
em runtime; OIDC Core §5.3.2 exige que o `sub` do `userinfo` seja igual ao do `id_token`. O
schema de claims já existe em `src/auth/claims.ts` (ADR 0007) e a ADR previu seu reuso aqui.
A ADR 0008 fixou que `401` deixa a requisição pendente e que `UnauthorizedError` só emerge sem
redirect; qualquer retentativa da biblioteca sobre `401` multiplicaria requisições com token
morto. A verificação manual do critério de aceite depende do refetch em foco de aba.

## Decisão

Vamos instalar `@tanstack/react-query` v5 e concentrar o recurso em `src/api/userinfo.ts`:
`fetchUserinfo(expectedSub)` obtém a URL por `userManager.metadataService.getUserInfoEndpoint()`,
chama `authGet`, rejeita status não-2xx com erro genérico, faz `claimsSchema.parse` sobre o JSON
(chaves extras descartadas, `name` pode ser `""`) e rejeita `sub` diferente de `expectedSub`;
`useUserinfo(sub)` é `useQuery({ queryKey: ["userinfo", sub], queryFn })`. O `sub` esperado vem
das claims validadas do contexto, passado pela página — o hook não lê o `User` — e entra na chave
de cache, de modo que identidade diferente nunca reaproveita dado em cache. Um `QueryClient`
único em `src/api/queryClient.ts` define `retry` como função: `false` para `UnauthorizedError`,
uma retentativa para o resto; `refetchOnWindowFocus` e `staleTime` ficam nos padrões. O
`QueryClientProvider` envolve `AuthProvider` em `main.tsx`. `Area` renderiza duas seções rotuladas
— `id_token` (contexto) e `userinfo` (hook) — e só a segunda tem estados de carregamento e falha;
todo erro que chega à página é tratado como falha genérica.

## Consequências

Positivas:

- `/app` prova o modelo de confiança inteiro: `id_token` validado e `access_token` aceito por um
  recurso protegido em outra origem, com a URL vinda do discovery.
- Um contrato de identidade só (`claimsSchema`) para `id_token` e `userinfo`; divergência entre
  as duas fontes é rejeitada na borda, não renderizada.
- `401` nunca é retentado; rede, 5xx e contrato falham em cerca de um segundo, o que mantém a
  verificação manual legível.
- Token expirado em memória passa a ser detectado na primeira chamada ao `userinfo` — cobertura
  parcial do tech-debt "`getUser()` ignora `expires_at`" (TASK-003).
- O provider fora de `AuthProvider` permite, na etapa 6, limpar o cache ao ouvir `userUnloaded`.

Negativas:

- Dependência e provider novos para uma consulta só; o ganho é a camada que todo dado remoto
  futuro atravessa, não esta chamada.
- `staleTime: 0` com refetch em foco pode mandar ao IdP no meio do uso quando o token expira;
  aceito no sandbox e é o comportamento que o critério de aceite pede.
- Em v5 o refetch em foco escuta `visibilitychange`, não `focus`: a verificação manual precisa
  trocar de aba (ou minimizar), não apenas clicar na janela.
- A retentativa única também se aplica a erros determinísticos (contrato, `sub` divergente):
  uma requisição a mais antes da falha. Distinguir exigiria mais uma classe de erro.
- Dados de identidade ficam no cache do `QueryClient` até a página morrer; "Sair" (etapa 6)
  precisa limpá-los.
- `RequireAuth` continua admitindo token expirado em `/app`; I8 "token válido" segue parcial.

## Alternativas consideradas

- **`loadUserInfo: true` no `UserManager`** — a biblioteca busca o `userinfo` no callback e
  mescla em `profile`. Descartado: some a chamada que se quer demonstrar, perde o estado de
  carregamento/falha e o `401` em refetch, e reabre a ADR 0006.
- **`fetch` direto em `useEffect` na página** — sem dependência nova. Descartado: reimplementa
  cache, dedup do StrictMode, refetch e estados; contraria o núcleo, que fixa TanStack Query.
- **Checar `sub` lendo `getUser().profile.sub` em `http.ts`** — o hook não precisaria do `sub`.
  Descartado: aproxima `User` da camada de API sem necessidade e tira o `sub` da chave de cache.
- **Chave de cache fixa `["userinfo"]`** — mais simples. Descartada: troca de usuário na mesma
  vida da página serviria cache do usuário anterior por um instante.
- **`retry` padrão (3, com backoff)** — sem configuração. Descartado: `401` seria retentado e a
  falha demoraria ~7 s a aparecer.
- **Página distinguindo `UnauthorizedError` com tela "Redirecionando…"** — descartada: com a
  ADR 0008 esse erro não chega à página antes do redirect; a tela seria código morto.
