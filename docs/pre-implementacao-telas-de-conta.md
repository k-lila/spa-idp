# Pré-implementação: telas de conta

| Campo | Valor |
| --- | --- |
| Natureza | relatório de pré-implementação; apoio à tarefa, não decisão. Nenhuma ADR (Architecture Decision Record) o cita, e ele é retirado quando a tarefa fecha |
| Data | 2026-10-01, com o código da aplicação de página única (SPA, de _Single-Page Application_) em `main` (8396e9a) e o do provedor de identidade (IdP, de _Identity Provider_) na árvore de trabalho, sem commit |
| Fonte | documentos de trabalho `jornada-usuario.md` (§4, §5, §7, §11) e `dominio-usuario.md` (§5, §6, §8), na raiz do observatório; ADR 0031 do IdP (proposta) |
| Forma | uma tarefa só, pela rota `/feature`, em seis fatias (§4), num commit só e numa implantação só |
| Revisão | 2026-10-06: D-1 reescrita (alternativa A′), D-13 revisada, D-16 nova; commit único no fim; reconferência contra a árvore de trabalho do IdP |

## 1. Objetivo

A pessoa passa a criar a conta, ler e editar nome, sobrenome e apelido, aceitar os termos,
reenviar a confirmação de e-mail e chegar às páginas do IdP que pedem senha (trocar senha,
trocar e-mail, excluir, recuperar). A SPA continua sem campo de senha (I8): tudo o que recebe
senha é página do IdP. A SPA lê e escreve na conta pela interface de programação (API) JSON do
IdP, com o próprio `access_token`.

## 2. Decisões que este relatório fixa

Tomadas pela pessoa usuária em 2026-10-01 e revistas em 2026-10-06, ou escolhidas aqui onde a
jornada deixou "a decidir lá". Todas entram na ADR 0020.

| # | Tema | Decisão | Por quê |
| --- | --- | --- | --- |
| D-1 | `403 insufficient_scope` | Sem tratamento próprio: vira o erro genérico da tela. A ADR 0020 registra as premissas e os gatilhos de revisão (abaixo da tabela) | Nenhuma aba combina bundle novo com token sem `conta`: a aba antiga roda o bundle antigo, que não chama a API de conta, e o bundle novo sempre pede `conta`. Mesmo que o caso ocorresse, um novo login devolveria o mesmo token sem `conta`, e a trava só acrescentaria uma ida e volta ao IdP antes do mesmo erro |
| D-2 | Versão no aceite | A SPA envia a versão do texto que ela exibe (`TERMOS_VERSAO`, constante da SPA) | O aceite registra exatamente o texto mostrado. Divergência com o IdP vira `termos_desatualizados`, com mensagem |
| D-3 | Claims novas | `email_verified`, `nickname` e `updated_at` opcionais no `claimsSchema`; tipo inesperado é descartado, não recusa o login | Documentam o contrato sem fazer o login depender delas; nenhuma tela as lê do `id_token` |
| D-4 | `/app` | Mantém as seções `id_token` e `userinfo`, e o `ClaimsList` continua com `sub`, `name` e `email`; ganha saudação, faixa de e-mail e link "Minha conta" | Os testes de ponta a ponta (e2e) continuam valendo (t03 conta três `dd`), e a seção ajuda a conferir o `sub` UUID na integração |
| D-5 | Guarda de termos | Compara `termos_versao` com `termos_versao_vigente`, ambos do GET da conta | A vigência é do IdP. A D-2 só decide o que se envia |
| D-6 | GET da conta falha na guarda | `/app` não abre: mensagem, "tentar de novo" e "Sair" | Sem o GET não se sabe se os termos foram aceitos |
| D-7 | `401` no PATCH | O formulário se perde; o novo login volta à página atual | Solução mais simples; o token dura 10 h |
| D-8 | Validação local | Só `maxLength={150}` nos três campos | É o limite do IdP; o IdP continua sendo a autoridade |
| D-9 | Limpeza na volta da exclusão | Nenhuma | `userStore` é `InMemoryWebStorage`; o `stateStore` se limpa sozinho |
| D-10 | `prompt=create` no fake | O fake retira `create` do pedido e segue para o login | Prova o caminho da SPA sem simular a página de cadastro do IdP |
| D-11 | Uso de `nickname` | Saudação: `nickname`, senão `first_name`, senão `email`, lidos do GET da conta | Apelido é como a pessoa quer ser chamada |
| D-12 | Divergência de `sub` na transição | Só a mensagem atual; nenhum login automático | Coerente com D-1; um reload resolve pela sessão de login único (SSO) do IdP |
| D-13 | Textos dos termos | `src/termos.ts` exporta `TERMOS_VERSAO`, `TEXTO_TERMOS` e `TEXTO_PRIVACIDADE`, por ora com marcadores ("texto do termo…"); `Termos.tsx` e `Privacidade.tsx` só exibem, com a versão vinda de `TERMOS_VERSAO` | Um lugar só para trocar o texto; sem dependência nova (Markdown exigiria parser) |
| D-14 | Trava de re-autenticação | O marcador guarda a URL que recebeu o `401`; outro `401` na mesma URL lança; só uma resposta que não seja `401` da mesma URL o apaga | Com dois recursos, o sucesso do GET da conta apagaria a trava do `userinfo` a cada carga de `/app`, e o laço `/app → IdP → /app` que a ADR 0008 cortou voltaria |
| D-15 | Retentativa do GET da conta | Fica o padrão do `queryClient`: uma retentativa, também para os `403` | Custa uma requisição num caso raro; uma regra própria de `retry` seria código para nada |
| D-16 | `403 conta_inativa` na guarda | A tela da D-6 com "Esta conta está desativada." e só o botão "Sair", sem "tentar de novo" | Tentar de novo não reativa a conta; o botão seria uma ação inútil |

**Premissas e gatilhos da D-1.** A D-1 vale enquanto:

- os tokens vivem só em memória e todo reload refaz o login (I3, ADR 0014);
- o IdP concede todo scope pedido, porque o toolkit não tem scope por Application;
- a Application da SPA tem `skip_authorization` (ADR 0021 do IdP);
- o `refresh_token` nunca é usado (ADR 0014).

A D-1 se revisita se o IdP passar a limitar scope por Application, ou se a SPA passar a usar o
`refresh_token` ou a persistir tokens.

**Pré-condição da fatia F0.** A D-1 contraria a jornada §5.2 ("a SPA trata esse caso como o
401"), a §5.5 passo 3 e o passo 1 do critério da §11, e o motivo que a ADR 0031 do IdP dá para
o desafio ("a SPA não distinguiria token vencido de scope faltando"). Antes de a ADR 0020 ser
escrita, duas propostas precisam estar aplicadas:

- **no observatório:** a jornada passa a dizer que nenhuma aba combina bundle novo com token sem
  `conta`;
- **no IdP:** a ADR 0031, ainda "Proposto", justifica o desafio pelo padrão da RFC 6750, útil a
  qualquer RP. O código do IdP não muda.

`CORS_EXPOSE_HEADERS` continua no IdP, e o `docs/contrato-idp.md` da SPA registra que a SPA hoje
não lê `WWW-Authenticate` nem `Retry-After`.

## 3. O que o IdP já implementou e a SPA consome

Lido na árvore de trabalho do IdP em 2026-10-01, sem commit. O IdP só commita quando os dois
lados funcionarem em desenvolvimento: antes da fatia F1, repetir a reconferência da §3.5 contra a
árvore de trabalho.

### 3.1 API

Todo caminho termina em barra. A base é a origem do issuer.

| Método e caminho | Corpo | Sucesso | Erros relevantes |
| --- | --- | --- | --- |
| `GET /api/conta/` | — | `200`, corpo da §3.2 | `401`; `403` |
| `PATCH /api/conta/` | `first_name`, `last_name`, `nickname` (presentes; ausente não apaga; `null` vale `""`) | `200`, mesmo corpo do GET | `400` `max_length` (150), `invalid` (não é texto), `json_invalido` em `geral` |
| `POST /api/conta/confirmacao/` | — | `204` sempre, enviando ou não | `401`; `403` |
| `POST /api/conta/termos/` | `{"versao": "<texto>"}`, comparado sem `strip` | `204` | `400` `termos_desatualizados` em `versao` |

Respostas de erro:
- `400`: `{"erros": {"<campo>": [{"codigo": "...", "mensagem": "..."}]}}`; `mensagem` em inglês.
- `401`: token ausente ou inválido, com `WWW-Authenticate: Bearer ...`.
- `403` com `WWW-Authenticate: Bearer error="insufficient_scope"`: sem scope `conta` (D-1).
- `403` com `{"codigo": "aplicacao_nao_autorizada"}`: token de outra Application.
- `403` com `{"codigo": "conta_inativa"}`: conta desativada. **Não está na jornada.**
- `429`: limite de 120 por minuto por origem em cada caminho, com `Retry-After`.

Compartilhamento entre origens (CORS): `CORS_URLS_REGEX = r"^/(?:o|api/conta)/"` e
`CORS_EXPOSE_HEADERS = ["WWW-Authenticate", "Retry-After"]`. Métodos e cabeçalhos no padrão do
`django-cors-headers`, que inclui `PATCH`, `authorization` e `content-type`.

### 3.2 Corpo do GET e do PATCH

| Campo | Tipo | Observação |
| --- | --- | --- |
| `sub` | string | UUID; igual ao `sub` das claims |
| `email` | string | minúsculas |
| `email_verified` | boolean | |
| `first_name`, `last_name`, `nickname` | string | podem ser `""` |
| `date_joined` | string ISO 8601 | |
| `updated_at` | string ISO 8601 | **na claim é inteiro (epoch)**; schemas separados |
| `senha_alterada_em` | string ISO 8601 ou `null` | |
| `termos_versao` | string | `""` se nunca aceitou |
| `termos_versao_vigente` | string | hoje `"1"` |

### 3.3 Páginas do IdP e voltas à SPA

| Página | Caminho | Volta à SPA |
| --- | --- | --- |
| Cadastro | `/accounts/registrar/`, pelo `prompt=create` ou pelo link da tela de login do IdP; a SPA não cita o caminho, só usa `prompt=create` | `/o/authorize/` retomado → `/callback` |
| Recuperar senha | `/accounts/password_reset/` | link "Ir para a aplicação" para `{SPA_URL}/`; não abre sessão |
| Trocar senha | `/accounts/password_change/` | `/app/conta?aviso=senha-trocada` |
| Trocar e-mail | `/accounts/email/` | `/app/conta?aviso=email-trocado` |
| Excluir | `/accounts/excluir/` | `/?conta=desativada` ou `/?conta=apagada` |
| Link de confirmação | `GET /api/conta/confirmar/?t=` | `/?email=confirmado` ou `/?email=invalido` |

As recusas que a SPA não decide, mas cujo texto não deve contradizer, estão na §5.

### 3.4 Claims e descoberta

- `sub` passa a UUID; `email_verified` no scope `email`; `nickname` (presente mesmo vazia) e
  `updated_at` (segundos inteiros) no scope `profile`, no `id_token` e no `userinfo`.
- Scope `conta` declarado; `OIDC_RP_INITIATED_REGISTRATION_ENABLED` ligado, e a descoberta passa
  a listar `create` em `prompt_values_supported`.
- A Application da SPA tem `skip_authorization` (ADR 0021 do IdP): o scope novo não abre tela de
  consentimento.

### 3.5 Reconferência do IdP

O lado do IdP está sem commit e pode mudar até os dois lados funcionarem em desenvolvimento.
Antes de F1, e de novo antes de F5, reler na árvore de trabalho:

| Arquivo do IdP | O que conferir |
| --- | --- |
| `accounts/api.py` | corpo de `_corpo` (§3.2); lista fechada e `max_length` do formulário de perfil; os três `codigo` de `403`; `termos_desatualizados` sem `strip`; destino de `confirmar` |
| `accounts/paginas.py` | destinos de volta à SPA de cada página (§3.3) |
| `config/urls.py` | caminhos da API e das páginas (§3.1, §3.3), todos com barra final |
| `config/settings.py` | `CORS_URLS_REGEX`, `CORS_EXPOSE_HEADERS`, `TERMOS_VERSAO_VIGENTE`, `RATE_LIMIT_POR_CAMINHO`, `OIDC_RP_INITIATED_REGISTRATION_*` e o scope `conta` em `OAUTH2_PROVIDER` |

Qualquer diferença volta a este relatório antes do código.

## 4. Implementação por fatias

A tarefa roda pela rota `/feature`. Toca contrato e fluxo de dados, então passa pela Fase 2
(`architect`), e por isso pelo gate `senso-critico`. A ADR 0020 sai do `architect` e o `writer`
a grava como veio; `.claude/memory/decisions.md` é atualizado no encerramento da rota.

Cada fatia termina com a suíte verde, como ponto de verificação, sem commit próprio. A SPA
commita uma vez só, no fim, quando os dois lados funcionarem em desenvolvimento, como o IdP. Nada
vai para produção antes disso: implantada antes do IdP, a SPA pede o scope `conta` e recebe
`invalid_scope`, e ninguém entra (§6).

| Fatia | Conteúdo | Critério de saída |
| --- | --- | --- |
| F0 | ADR e documentação | jornada e ADR 0031 do IdP ajustadas (§2); ADR 0020 "Proposto"; docs coerentes entre si |
| F1 | Fundação, sem tela | t03–t08 verdes; nada visível muda |
| F2 | Conta, guarda e termos | unitários de F2 e e2e t11 verdes |
| F3 | Minha conta e área | unitários de F3 e e2e t10, t12 verdes |
| F4 | Landing | unitários de F4 e e2e t09, t13 verdes |
| F5 | Integração | passos da §8 verdes contra o IdP real |

### 4.1 F0 — Documentação e decisão

| Arquivo | Mudança |
| --- | --- |
| `docs/adr/0020-telas-de-conta-…md` (novo) | Status "Proposto". Substitui a 0012; emenda a 0008 (escrita autenticada, `401` com retorno à página atual, trava por URL da D-14); muda a terceira cláusula de I1, I5, D2 e a restrição da §6 do núcleo sobre a API de conta; registra D-1 a D-15; aponta para a ADR 0031 do IdP; registra que I8 e as duas primeiras cláusulas de I1 continuam valendo. Passa a "Aceito" no mesmo ato que a 0031, e nesse ato a 0012 recebe "Substituído por ADR-0020" |
| `docs/spa-nucleo.md` | I1: a terceira cláusula passa a permitir escrever na própria conta pela API de conta, só com o scope `conta`. I5: exceção para os caminhos fixos da API e das páginas sobre a origem do issuer. D2 (§5): gestão de conta pelas telas da SPA e pelas páginas do IdP. §6: retirar a restrição "NÃO DEVE chamar a API de conta"; manter a de I8 |
| `docs/contrato-idp.md` | §1: a origem do issuer como base. §5: claims novas. Seção nova com a API, as páginas, as voltas, os erros e o scope `conta` (a §3 deste relatório). §9: o fake passa a simular a API e retira `create` (D-10), **preservando o ponteiro `../CLAUDE.md`** da última frase. §10: a ordem de implantação (IdP primeiro) e a troca de versão dos termos |
| `docs/arquitetura.md` | árvore de arquivos, camadas, rotas, estado (cache `["conta", sub]`), fluxos de ida e volta ao IdP; índice das ADRs com 0020 e o par SPA 0020 ↔ IdP 0031 no lugar de 0012 ↔ 0023 |
| `docs/seguranca.md` | §2: escrita restrita a `client_id` e scope; §4.6 (`email` sem verificação) passa a ter `email_verified`; registrar como premissa a isenção de proteção contra falsificação de requisição entre sites (CSRF) na API do IdP, que só vale porque ela não aceita sessão |
| `CLAUDE.md` | D2 e a faixa de ADRs (0001–0020) |
| `.env.example` | trocar "contrato-frontend §6.1" por `docs/contrato-idp.md` |

### 4.2 F1 — Fundação

**`src/config.ts`**
- Hoje: `config.oidc` com o issuer validado por `requiredUrl` e `scope: "openid profile email"`,
  com o comentário obsoleto "contrato (plano §3)".
- Muda:
  - `scope: "openid profile email conta"`, comentário apontando para `docs/contrato-idp.md`;
  - `config.idp`, derivado de `new URL(issuer).origin`, com `api.conta`, `api.confirmacao`,
    `api.termos`, `paginas.recuperarSenha`, `paginas.trocarSenha`, `paginas.trocarEmail`,
    `paginas.excluir`. Nenhuma variável nova (ADR 0005).
- Teste: `src/config.test.ts`.

**`src/api/http.ts`**
- Hoje: só `authGet(url)`; `401` chama `signin()` **sem destino**; a trava `spa.reauth` é um
  marcador único, apagado por qualquer resposta que não seja `401`.
- Muda:
  - `authSend(method, resource: keyof typeof config.idp.api, json?)`: o destino é uma chave da
    API de conta, nunca uma URL, para o tipo impedir escrita fora dela (I1). Mesmo Bearer,
    `Content-Type: application/json` só com corpo, mesma regra de `401`. Token e `User`
    continuam presos ao módulo (ADR 0008);
  - o `401` chama `signin(location.pathname + location.search + location.hash)`, lidos de
    `window.location` (o módulo não é componente), para um `401` em `/app/conta` voltar a
    `/app/conta`. t07 não muda: o `401` dele acontece em `/app`;
  - trava por URL (D-14): o marcador guarda a URL do `401`; um segundo `401` na mesma URL lança
    sem novo login; só uma resposta que não seja `401` da mesma URL o apaga;
  - o comentário que cita I1 como motivo de "só GET" é reescrito;
  - `403` não ganha ramo (D-1).
- Reusar: `REAUTH_KEY`, `UnauthorizedError`.
- Teste: `src/api/http.test.ts`, incluindo o caso "GET da conta `200` e `userinfo` `401`
  persistente não entra em laço".

**`src/auth/claims.ts`** (D-3)
- `email_verified`, `nickname` e `updated_at` opcionais, com tipo inesperado descartado
  (`.optional().catch(undefined)`). O `sub` UUID passa pelo `z.string().min(1)`.
- Corrigir a referência a `docs/contrato-frontend.md`.
- Teste: `claims.test.ts` (com e sem as claims; tipo errado descartado sem recusar o login).

**`src/auth/userManager.ts`, `AuthContext.ts`, `AuthProvider.tsx`**
- Hoje: `signin(returnTo?)` chama `signinRedirect({ nonce, state })`, memoizado em `redirecting`.
- Muda: `signup()`, que chama `signinRedirect({ nonce, prompt: "create" })` pelo mesmo
  `redirecting ??=`, exposto no contexto. O `oidc-client-ts` 3.5.0 aceita `prompt`
  (`ExtraSigninRequestArgs`). Corrigir o comentário "plano §5" do `stateStore`.
- Testes: `userManager.test.ts`, `AuthProvider.test.tsx` e os mocks de `useAuth` nos testes de
  página.

**IdP fake (`dev/idp-fake/server.js`)**
- `scopes: ["openid", "offline_access", "conta"]` (o padrão da lib não tem `conta`).
- `claims`: `profile: ["name", "nickname", "updated_at"]`, `email: ["email",
  "email_verified"]`; `findAccount` passa a ler a conta de um `Map` em memória.
- Contas: o login padrão nasce com `termos_versao: "1"` e `email_verified: true`, para os e2e
  atuais seguirem direto a `/app`. Logins especiais, no padrão de `BROKEN_USERS`:
  `sem-aceite` (`termos_versao: ""`) e `nao-confirmado` (`email_verified: false`).
- `prompt=create` (D-10): middleware express antes do provider retira `create` de `prompt` no
  pedido a `/o/auth`. A lib recusaria o valor com `invalid_request` (`checkPrompt`, em
  `oidc-provider/lib/actions/authorization/request_parameters.js`).
- API em `/api/conta/` no mesmo processo (a origem é a do issuer):
  - CORS manual (o `clientBasedCORS` só vale nas rotas do provider, e o pacote `cors` não é
    dependência): `Access-Control-Allow-Origin: http://localhost:5173`, métodos `GET, PATCH,
    POST`, cabeçalhos `authorization, content-type`, `Access-Control-Expose-Headers:
    WWW-Authenticate, Retry-After`, resposta à preflight;
  - Bearer por `provider.AccessToken.find(token)`: ausente ou inválido → `401` com
    `WWW-Authenticate: Bearer error="invalid_token"`; sem `conta` no `scope` → `403` com
    `insufficient_scope`; `clientId` diferente de `spa-local` → `403`
    `aplicacao_nao_autorizada`;
  - GET, PATCH (lista fechada, `max_length` 150), `POST confirmacao` (`204`), `POST termos`
    (`"1"` → `204`, outra → `400 termos_desatualizados`), com os corpos da §3;
  - `express.json()` só nessas rotas.
- Atualizar o comentário do topo.

Nenhuma tela usa o que esta fatia acrescenta: t03–t08 devem passar sem mudança.

### 4.3 F2 — Conta, guarda e termos

**`src/api/conta.ts`** (novo), no molde de `src/api/userinfo.ts`
- `contaSchema` com os campos da §3.2; `senha_alterada_em` `nullable`.
- `fetchConta(expectedSub)`: `authGet(config.idp.api.conta)`; `!res.ok` lança erro com o
  `codigo` do corpo quando houver (para `conta_inativa`); confere `sub` como `fetchUserinfo`.
- `useConta(sub)`: `queryKey: ["conta", sub]`. O foco da aba já refaz a busca
  (`refetchOnWindowFocus` e `staleTime` no padrão de `src/api/queryClient.ts`); retentativa no
  padrão (D-15).
- `useEditarConta(sub)`: `useMutation` com `authSend("PATCH", "conta", …)`; `200` grava o corpo com
  `setQueryData(["conta", sub])` e invalida `["userinfo", sub]`; `400` devolve os erros por
  campo, validados por `errosSchema`.
- `useReenviarConfirmacao()`: `authSend("POST", "confirmacao")`, espera `204`.
- `useAceitarTermos(sub)`: `authSend("POST", "termos", { versao: TERMOS_VERSAO })`;
  `204` invalida `["conta", sub]`; `400 termos_desatualizados` vira mensagem própria.
- `errosSchema`: `z.object({ erros: z.record(z.string(), z.array(z.object({ codigo:
  z.string(), mensagem: z.string() }))) })`.
- Mapa de mensagens por `codigo` (§5), com a `mensagem` do IdP como reserva.
- Mutations não retentam (padrão do TanStack); o `userUnloaded` já limpa o cache
  (`AuthProvider.tsx`).
- Teste: `src/api/conta.test.ts` (schema, `sub` divergente, erros por código, cache).

**`src/termos.ts`** (novo; D-2, D-13): `TERMOS_VERSAO = "1"`, `TEXTO_TERMOS` e
`TEXTO_PRIVACIDADE`, os dois textos por ora com marcadores ("texto do termo…").

**`src/router.tsx`**
```
/              Landing
/callback      Callback
/termos        Termos            (público)
/privacidade   Privacidade       (público)
/app           <RequireAuth><RequireTermos><Outlet/></RequireTermos></RequireAuth>
  index        Area
  conta        Conta             (F3; até lá, ausente)
  termos       AceiteDosTermos
*              NotFound
```

**`src/auth/RequireTermos.tsx`** (novo; D-5, D-6, D-16)
- Lê `useConta(claims.sub)`. Pendente: nada (como `RequireAuth`). Erro: mensagem, "tentar de
  novo" (`refetch`) e `BotaoSair`; com status `429`, a mensagem é a do `429` (§5). Com `codigo`
  `conta_inativa`: "Esta conta está desativada." e só `BotaoSair`.
- Se `termos_versao !== termos_versao_vigente` e o caminho não é `/app/termos`:
  `<Navigate to="/app/termos" replace state={{ from: pathname + search + hash }} />`.
- Em `/app/termos` com os termos já aceitos: vai a `state.from` se for `/app` ou começar por
  `/app/`, `/app?` ou `/app#`; senão, a `/app`, com `replace` (ver o item de `AceiteDosTermos`).
- Teste: `src/auth/RequireTermos.test.tsx`, no molde de `RequireAuth.test.tsx`.

**`src/pages/BotaoSair.tsx`** (novo, extraído do botão "Sair" de `Area.tsx`): a mesma regra de
falha (`navigate("/", { state: { signoutFailed: true } })`). Usado na área, em `/app/termos` e na
falha da guarda.

**`src/pages/AceiteDosTermos.tsx`** (novo)
- Links para `/termos` e `/privacidade`, caixa "Li e aceito…" com a versão, botão "Aceitar",
  `BotaoSair` e o link "Excluir conta" para `config.idp.paginas.excluir`, por navegação de página
  inteira: recusar os termos não impede excluir a conta. Com `204`, não navega: a volta ao destino é da guarda, que, ao ver os termos
  aceitos em `/app/termos`, vai para `state.from` se for `/app` ou começar por `/app/`, `/app?`
  ou `/app#`, senão para `/app`, com `replace`. Navegar daqui correria com ela: a guarda
  redirecionaria antes, desmontando `AceiteDosTermos`, e o TanStack Query não chama o
  `onSuccess` do `mutate` com o observador desmontado. O `onSuccess` do hook espera a nova busca
  da conta, e o botão fica pendente até a guarda ver o aceite.

**`src/pages/Termos.tsx` e `src/pages/Privacidade.tsx`** (novos, públicos; D-13)
- Exibem `TEXTO_TERMOS` e `TEXTO_PRIVACIDADE`, com "Versão {TERMOS_VERSAO}". O texto entregue
  pela pessoa dona do sistema troca só o marcador de `src/termos.ts`; **a implantação espera o
  texto** (§6).

`vercel.json` já reescreve tudo para `index.html`: as rotas novas não pedem configuração.

E2e: `t11` — login `sem-aceite` cai em `/app/termos` vindo de `/app`, aceita e volta a `/app`.
Em F3, estende-se para partir de `/app/conta`.

### 4.4 F3 — Minha conta e área

**`src/pages/Area.tsx`** (D-4, D-11)
- Mantém as seções `id_token` e `userinfo` e o `ClaimsList` com os três campos de hoje.
- Acrescenta a saudação (D-11), a faixa "Confirme seu e-mail" com "Reenviar" quando
  `email_verified` é falso, e o link "Minha conta" para `/app/conta`.
- A conta já está em cache pela guarda: a área lê `useConta` sem nova espera.

**`src/pages/Conta.tsx`** (novo)
- Formulário de nome, sobrenome e apelido (D-8), com rótulo e ajuda do apelido; envia só os
  campos alterados desde a carga ou o último `200` (ausente não apaga), para que campo não tocado
  não sobrescreva o que mudou por outro caminho; sem alteração, não envia. Erros por campo pelo
  mapa da §5.
- Ao fim do envio, o foco volta ao primeiro campo inválido, que lê o erro pelo
  `aria-describedby`, ou ao "Salvar"; "Alterações salvas." numa região viva montada sempre.
- O envio cancela a busca da conta em curso, para um GET por foco não voltar o cache à conta
  antiga depois do `200`.
- E-mail atual, estado de confirmação e `senha_alterada_em` formatada em `pt-BR`.
- Links `<a>` (navegação de página inteira): "Trocar senha", "Trocar e-mail".
- Zona de perigo: explica desativar e apagar e leva a `paginas.excluir`. Não promete o que o IdP
  pode recusar (§5).
- `?aviso=` lido uma vez, guardado em estado e retirado da URL com `replace`.

E2e: `t10` — editar o nome em `/app/conta`, recarregar e ver o valor novo; `t12` — login
`nao-confirmado` vê a faixa e "Reenviar".

### 4.5 F4 — Landing

**`src/pages/Landing.tsx`**
- "Criar conta" ao lado de "Entrar", chamando `auth.signup()` com o mesmo tratamento de falha.
- "Esqueci a senha": `<a href={config.idp.paginas.recuperarSenha}>`.
- `?email=` e `?conta=`: só `confirmado`, `invalido`, `desativada` e `apagada` viram aviso; o
  valor é lido uma vez, guardado em estado e retirado da URL com `replace`.
- Texto junto de "Criar conta" (§5).

E2e:
- `t09`: "Criar conta" leva ao IdP com `prompt=create` no pedido a `/o/auth` (conferido pelo
  evento `request`, como em t07) e chega a `/app` logado. Sem a conferência do pedido, o teste
  repetiria t03, porque o fake retira `create` (D-10);
- `t13`: `/?email=confirmado`, `/?conta=apagada` e `/app/conta?aviso=senha-trocada` mostram o
  aviso e limpam a query; os `href` das páginas do IdP apontam para a origem do issuer.

### 4.6 F5 — Integração

Os passos da §8, contra o IdP real. A tarefa só fecha aqui.

### 4.7 Testes

Unitários (vitest), um arquivo por módulo tocado, na fatia do módulo. E2e (Playwright) contra o
fake: t03–t08 verdes em toda fatia, e t09–t13 na fatia indicada. O `quality-assurance` confirma
os níveis antes da escrita, como manda o fluxo do projeto.

**Intocados:** `src/auth/idToken.ts`, `src/auth/RequireAuth.tsx`, `src/pages/Callback.tsx`,
`src/api/queryClient.ts`, `vercel.json`, `package.json` (nenhuma dependência nova).

## 5. Textos de interface

Um lugar só para revisão de linguagem e para os asserts dos testes.

| Onde | Gatilho | Texto |
| --- | --- | --- |
| Landing | `?email=confirmado` | "E-mail confirmado. Entre para continuar." |
| Landing | `?email=invalido` | "O link de confirmação não vale mais. Entre e peça outro." |
| Landing | `?conta=desativada` | "Conta desativada. Para reativá-la, fale com quem administra." |
| Landing | `?conta=apagada` | "Conta apagada." |
| Landing | junto de "Criar conta" | com sessão aberta no IdP, a pessoa entra na conta existente |
| Minha conta | `?aviso=senha-trocada` | "Senha trocada." (encerrar as outras sessões é do IdP; a SPA não promete) |
| Minha conta | `?aviso=email-trocado` | "E-mail trocado. Confirme o novo endereço pelo link enviado." |
| Minha conta | ajuda do apelido | "Como prefere ser chamado?" |
| Área | faixa, `email_verified` falso | "Confirme seu e-mail" e "Reenviar" |
| Área | `204` do reenvio | "Se o e-mail ainda não foi confirmado, enviamos um novo link." |
| Erro por `codigo` | `max_length` | "Use no máximo 150 caracteres." |
| Erro por `codigo` | `invalid` | "Valor inválido." |
| Erro por `codigo` | `termos_desatualizados` | "Os termos foram atualizados e esta página ainda não tem a versão nova. Tente mais tarde." |
| Guarda, erro por `codigo` | `conta_inativa` | "Esta conta está desativada.", só com "Sair" (D-16) |
| Erro por status | `429`, também na guarda | "Muitas tentativas. Tente de novo em instantes." |
| Aceite dos termos | ao lado de "Sair" | "Excluir conta" |

"Recarregue a página" não serve para `termos_desatualizados`: a versão exibida é a constante do
bundle (D-2), e recarregar mostra o mesmo texto.

Recusas do IdP que a SPA não decide, mas cujo texto (zona de perigo, "Esqueci a senha") não deve
contradizer: exclusão de conta da equipe; "apagar" de conta dona de Application (só desativa);
link de recuperação para conta da equipe.

## 6. Bloqueios e pré-requisitos

| O quê | Bloqueia | Dono |
| --- | --- | --- |
| Jornada corrigida (§5.2, §5.5 passo 3, §11 passo 1) conforme a D-1 | escrita da ADR 0020 (F0) | observatório |
| Motivo do desafio na ADR 0031 do IdP ajustado (RFC 6750, não a SPA) | escrita da ADR 0020 (F0) | IdP |
| Reconferência do IdP (§3.5) | F1 e F5 | SPA |
| Texto da versão 1 dos termos e da política de privacidade | implantação (não o código) | pessoa dona do sistema |
| ADR 0031 do IdP e ADR 0020 da SPA aceitas no mesmo ato | implantação | os dois lados |
| IdP rodando localmente com a árvore de trabalho, com `SPA_CLIENT_ID` certo no `.env` | F5 | IdP |
| Commit dos dois lados, depois de F5 verde; IdP implantado em produção antes da SPA | implantação | os dois lados |
| Descoberta do IdP publicando `conta`, `email_verified` e `create` | implantação da SPA | observatório confere |

## 7. Riscos de implementação

- **Guarda dependente da API.** Toda rota de `/app` passa a esperar o `GET /api/conta/`. API
  fora do ar fecha a área (D-6).
- **Dois `updated_at`.** ISO na API, epoch na claim. Schemas separados; nunca comparar os dois.
- **Troca de versão dos termos.** Exige decisão nos dois lados e janela em que o IdP aceite as
  duas versões (ADR 0031 do IdP). Se o IdP passar a outra versão antes da SPA, a guarda manda
  todos a `/app/termos`, o aceite recebe `termos_desatualizados`, e `/app` fica fechada até a SPA
  nova sair. A D-2 faz a SPA falhar com mensagem, não aceitar o texto errado. A janela sozinha
  não basta: o que conta como aceito durante ela está em aberto (`docs/apontamentos.md` A-13).
- **`SPA_CLIENT_ID` errado no IdP** não derruba o login: toda chamada à API recebe
  `aplicacao_nao_autorizada`, e a guarda fecha `/app`.
- **Transição do `sub`.** Abas abertas antes da implantação do IdP mostram "Não foi possível
  obter o userinfo" até o reload (D-12).
- **Formulário perdido** num `401` durante o PATCH (D-7).
- **Última escrita vence no mesmo campo.** O PATCH leva só os campos alterados, mas o contrato
  não tem precondição de versão: se o mesmo campo mudou por outro caminho depois da carga, o
  envio o sobrescreve sem aviso.
- **Formulário perdido numa nova busca que falha.** Como a D-6 fecha a área em qualquer erro do
  GET da conta, uma nova busca por foco que falhe (instabilidade, `429`) desmonta tudo sob
  `/app`, e o que estava digitado (Minha conta, F3) ou marcado (aceite) se perde: o mesmo efeito
  da D-7, sem envio nenhum.
- **Retentativa dos `403`** do GET da conta: uma requisição a mais (D-15).

## 8. Verificação

Em toda fatia: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`,
`npm run test:e2e` (t03–t08 e os e2e já escritos) e `npm run build`, mais o critério de saída da
fatia (§4).

Em F5, contra o IdP real em `https://localhost/o` (`VITE_OIDC_ISSUER` no `.env.local`; SPA em
`https://localhost:5173`, navegador confiando na CA local do IdP), na
ordem da tabela da §9. Em desenvolvimento o IdP usa o backend de console: os links de e-mail
saem no log dele. Conferir também no código que nenhuma tela tem `type="password"` (I8).
Passos que só o IdP real prova:

- "Criar conta" com sessão aberta no IdP: a pessoa entra na conta existente, como dizem a nota
  da Landing e o contrato §4; se não entrar, a nota e o contrato mudam (A-14).
- Depois de excluir a conta, e depois de trocar a senha, apertar Voltar até `/app/conta`: se a
  página voltar do bfcache com os dados da conta, reabrir a D-9 (ADR 0020).
- Token revogado (trocar a senha, ou sair em outra aba) volta a pedir login pelo `401` (A-10).
- `?aviso=senha-trocada` sobrevive ao novo login e aparece em `/app/conta`.

Depois da implantação em produção, repetir F5 e comparar, do observatório, o contrato com o do
IdP.

A tarefa só fecha com F5 verde: e2e verde prova o código, não a integração.

## 9. Rastreabilidade

Semente dos critérios de aceite (`AC-NN`) do `product-manager`. "Integração" é o que só o IdP
real prova.

| Jornada | O que a SPA faz | Item | Prova |
| --- | --- | --- | --- |
| §4.1 Registrar | "Criar conta" com `prompt=create`; volta logada | F1 `signup()`, F4 Landing | unitário de `userManager` e `Landing`; e2e t09; integração §11 passo 2 |
| §4.2 Confirmar o e-mail | aviso de `?email=`; faixa e "Reenviar"; refeito no foco | F2 `conta.ts`, F3 Área, F4 Landing | unitários; e2e t12, t13; integração §11 passos 2 e 3 |
| §4.3 Entrar e ler a conta | scope `conta`; GET validado; cache `["conta", sub]`; `401` → novo login; `403` de scope sem ramo (D-1) | F1 `config`, `http`, `claims`; F2 `conta.ts` | unitários; e2e t03–t08; integração §11 passo 2 (o passo 1 sai pela D-1) |
| §4.4 Editar nome, sobrenome e apelido | PATCH, erros por `codigo`, invalida `userinfo` | F2 `conta.ts`, F3 Minha conta | unitários; e2e t10; integração §11 passo 3 |
| §4.5 Trocar o e-mail | link para a página do IdP; `?aviso=email-trocado`; faixa | F1 `config.idp`, F3 Minha conta | unitários; e2e t13 (`href`); integração §11 passo 3 |
| §4.6 Trocar a senha | link; `?aviso=senha-trocada` | F1 `config.idp`, F3 Minha conta | unitários; e2e t13; integração §11 passo 4 |
| §4.7 Excluir | zona de perigo; `?conta=`; nenhuma limpeza (D-9) | F3 Minha conta, F4 Landing | unitários; e2e t13; integração §11 passo 6 |
| §4.8 Recuperar a senha | "Esqueci a senha" na landing | F1 `config.idp`, F4 Landing | unitário; e2e t13 (`href`); integração §11 passo 4 |
| §4.9 Conta desativada no login | nada | — | integração §11 passo 6 |
| §4.10 Requisitos de senha | nada; nenhum campo de senha (I8) | — | integração §11 passo 7 |
| §4.11 Aceitar os termos | `/termos`, `/privacidade`, guarda, aceite | F2 inteira | unitários; e2e t11; integração §11 passo 2 |
| §4.12 Ida e volta | links sobre a origem do issuer; volta pelo SSO com destino | F1 `config.idp`, `http` | unitários; e2e t13; integração §11 passos 3 a 6 |
| §11 passo 5 | nada; e-mail em outra caixa | — | integração |
| Domínio §6.2–§6.3 | `sub` UUID pelo schema atual; divergência só com mensagem (D-12) | F1 `claims` | unitário; integração §11 passo 2 |
| Domínio §8 | rótulo do apelido, saudação, transição do `sub` | D-11, D-12, §5 | unitários de Área e Minha conta |
