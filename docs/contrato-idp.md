# Contrato com o IdP

O que a SPA, como relying party (RP) OIDC (OpenID Connect), assume do provedor de identidade
(IdP) e o que ela lhe entrega. A fonte canônica do lado do IdP é `docs/integracao-rp.md` do
IdP; este documento diz como a SPA a cumpre e onde, no código, cada
cláusula vive. Mudar qualquer item daqui é mudar os dois projetos (§10).

---

## §1. Coordenadas

| Item | Valor | Onde na SPA |
|---|---|---|
| Issuer | `{BASE_URL}/o`, sem barra final nem porta (ADR 0017; ADR 0025 do IdP) | `VITE_OIDC_ISSUER` |
| Descoberta | `{issuer}/.well-known/openid-configuration` | `authority` em `src/auth/userManager.ts` |
| Endpoints | `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, `end_session_endpoint`, `jwks_uri` | sempre lidos da descoberta, nunca fixados (I5) |
| Origem do IdP | `new URL(issuer).origin` | base dos caminhos fixos da API e das páginas de conta (§11), em `config.idp` de `src/config.ts` (I5, ADR 0020) |

| Ambiente | Issuer |
|---|---|
| Produção | `https://<dominio-do-idp>/o`, servido pelo Cloudflare Tunnel (ADR 0018; ADR 0027 do IdP) |
| Desenvolvimento | `https://localhost/o`, servido pelo proxy do IdP com certificado de uma CA local em que o navegador precisa confiar; a SPA de dev em `https://localhost:5173`, com certificado do `mkcert` |
| e2e | `http://localhost:9000/o` (IdP fake, não o real; §9) |

---

## §2. O que o IdP registra para a SPA

Uma `Application` por ambiente, criada à mão no admin do IdP:

| Campo | Valor |
|---|---|
| `client_type` | `public`: a SPA não tem `client_secret` |
| `authorization_grant_type` | `authorization-code` |
| `algorithm` | `RS256`; sem ele não há `id_token` |
| `skip_authorization` | `True`: a SPA é primeira parte e volta ao IdP a cada reload (ADR 0021 do IdP) |
| `redirect_uris` | `https://<spa>/callback` · `https://localhost:5173/callback` |
| `post_logout_redirect_uris` | `https://<spa>/` · `https://localhost:5173/`, **com** a barra final |

As duas URIs são comparadas por **igualdade exata** (esquema, host, porta, path, barra final).
O admin do IdP não valida `post_logout_redirect_uris`: um cadastro errado só aparece no primeiro
"Sair".

Além da `Application`, a origem exata da SPA (`https://<spa>`, `https://localhost:5173`, sem
barra) entra em `CORS_ALLOWED_ORIGINS` do IdP. A allowlist governa `/o/token/`, `/o/userinfo/`
e a API de conta sob `/api/conta/`; descoberta e JWKS respondem a qualquer origem (ADR 0022 do
IdP).

O IdP lê o `client_id` da SPA de `SPA_CLIENT_ID`. Errado, ele não derruba o login, mas a API
recusa tudo com `aplicacao_nao_autorizada`, e `/app` fica fechada.

Previews da Vercel não têm `Application` nem entrada no CORS, e por isso não autenticam
(ADR 0016; ADR 0022 do IdP). Se um preview precisar autenticar, um alias estável ganha
`Application` própria; `*.vercel.app` nunca.

---

## §3. O que a SPA recebe e onde guarda

Do IdP vêm o issuer e o `client_id` de cada ambiente. O resto é da SPA. Tudo entra por variável
de ambiente, validada no boot por `src/config.ts` (I6, ADR 0005):

| Variável | Conteúdo |
|---|---|
| `VITE_OIDC_ISSUER` | issuer do §1 |
| `VITE_OIDC_CLIENT_ID` | `client_id` da `Application` |
| `VITE_OIDC_REDIRECT_URI` | o mesmo valor de `redirect_uris` |
| `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` | o mesmo valor de `post_logout_redirect_uris`, byte a byte |

O scope não varia por ambiente: `openid profile email conta`, fixo em `src/config.ts`. `conta` só
é exigido pela API de conta e não libera claim.

---

## §4. O fluxo, endpoint a endpoint

| Endpoint | Como a SPA chama | O que envia | Onde |
|---|---|---|---|
| authorize | navegação de página inteira | `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state` (gerado pela biblioteca), `code_challenge` com `S256`, `nonce` novo a cada chamada; `prompt=create` em `signup()` (Criar conta) | `signin()` e `signup()` em `userManager.ts` |
| token | `fetch` com CORS | `code`, `code_verifier`, `redirect_uri`, `client_id`; sem secret | `completeSignin()` |
| jwks | `fetch` | nada | `remoteJwks()` em `src/auth/idToken.ts` |
| userinfo | `fetch` com CORS, só `GET` | `Authorization: Bearer <access_token>` | `authGet()` em `src/api/http.ts`, `fetchUserinfo()` em `src/api/userinfo.ts` |
| API de conta | `fetch` com CORS; GET, PATCH e POST com JSON; sem cookie | `Authorization: Bearer <access_token>` | `authGet()`/`authSend()` em `src/api/http.ts`, `src/api/conta.ts` (§11) |
| end_session | navegação de página inteira | `post_logout_redirect_uri` e `id_token_hint` (`client_id` só na falta do hint); **sem** `state` | `signout()` (ADR 0019) |

- **Volta do authorize:** `/callback?code=…&state=…`. A biblioteca confere o `state`. Com `error`
  no lugar de `code`, o `Callback` mostra o estado de erro.
- **Criar conta:** com sessão aberta no IdP, `create` não muda nada e a pessoa entra na conta
  existente.
- **Logout:** `signoutRedirect()` não recebe argumentos; a biblioteca acrescenta sozinha o
  `id_token` em memória como `id_token_hint`. Com o hint vivo, o IdP encerra a sessão, revoga os
  tokens da conta **nesta** `Application` e volta a `/` sem pedir confirmação (ADR 0029 do IdP).

---

## §5. Claims

| Claim | Contrato do IdP | O que a SPA faz |
|---|---|---|
| `sub` | UUID versão 4, minúsculo com hífens (ADR 0031 do IdP) | exige não vazia; chave dos caches `["userinfo", sub]` e `["conta", sub]` |
| `name` | `get_full_name()`, **pode ser `""`** | aceita vazia; a `Area` mostra "(sem nome)" |
| `email` | identificador de login | exige não vazia; só exibe |
| `email_verified` | booleana, scope `email` | opcional; tipo inesperado é descartado, não recusa o login; a SPA não a lê do `id_token` |
| `nickname` | presente mesmo vazia, scope `profile` | opcional; tipo inesperado é descartado, não recusa o login; a SPA não a lê do `id_token` |
| `updated_at` | inteiro, segundos desde 1970, scope `profile` | opcional; tipo inesperado é descartado, não recusa o login; a SPA não a lê do `id_token` |

O schema está em `src/auth/claims.ts` (zod, ADR 0007). Claims extras (`iat`, `auth_time`, `sid`,
…) são toleradas e descartadas. O mesmo schema valida o `id_token` e o userinfo, e o `sub` do
userinfo tem de ser igual ao do `id_token` (ADR 0009).

**`updated_at` na API de conta sai em ISO 8601:** schemas separados, nunca comparados.

O IdP não emite grupos nem papéis. A SPA não decide nada a partir do `email` nem de
`email_verified`. O estado de confirmação que a área mostra vem do GET da conta (§11). A chave de
identidade é o par `(iss, sub)`. A implantação da ADR 0031 do IdP troca o `sub` de toda conta, e
a sessão aberta antes dela mostra erro no userinfo até o reload (ADR 0020).

---

## §6. Verificação do `id_token`

A verificação se divide entre duas bibliotecas (ADR 0013):

| Verificação | Quem faz |
|---|---|
| assinatura RS256 contra a chave do `jwks_uri` cujo `kid` casa | `jose` (`verifyIdToken`) |
| `iss` igual a `VITE_OIDC_ISSUER`, byte a byte | `jose` |
| `aud` contém o `client_id` | `jose` |
| `exp` presente e no futuro, com tolerância de 60 s | `jose` |
| `nonce` igual ao enviado | `oidc-client-ts` |
| `state` igual ao enviado | `oidc-client-ts` |

O JWKS publica hoje **uma** chave. `createRemoteJWKSet` recarrega o conjunto quando vê um `kid`
desconhecido, e é essa recarga que sobrevive a uma troca de chave no IdP.

Qualquer falha descarta os tokens da tentativa (`removeUser()`) antes de mostrar o erro.

---

## §7. Tempos de vida

| Token | Validade no IdP | O que a SPA faz |
|---|---|---|
| `code` | 60 s | troca na mesma carga de `/callback` |
| `access_token` | 10 h | usa até o IdP recusar; um `401` refaz o login com volta à página atual, uma vez por URL em cada aba (ADRs 0008, 0020) |
| `id_token` | 10 h | verificado uma vez, no callback |
| `refresh_token` | não expira; rotacionado a cada uso | recebe e **nunca usa** (ADR 0014) |

Sem renovação silenciosa (`automaticSilentRenew: false`) e sem iframe de sessão
(`monitorSession: false`). Tokens só em memória: o reload os perde, e a volta ao IdP com SSO
devolve a sessão sem senha (ADR 0014).

---

## §8. Comportamentos do IdP que a SPA tolera

| Comportamento | Como aparece | Tratamento |
|---|---|---|
| Origem fora do CORS | falha de rede, sem status | estado de erro do `Callback` ou do userinfo |
| Limite de 120 requisições por minuto em authorize e token | `429` | no authorize, a resposta fica na tela do IdP; no token, erro do `Callback`. Em ambos a pessoa tenta de novo |
| IdP lento ou fora do ar | sem resposta | a descoberta e `/o/token/` rejeitam em 15 s (ADR 0015) |
| `skip_authorization` desmarcado | tela de consentimento a cada ida | um passo a mais no redirect; nada quebra |
| Hint sem registro no logout (outra aba já saiu) | tela de confirmação no IdP | a pessoa confirma lá; a SPA já esqueceu os tokens |
| Descoberta sem `end_session_endpoint` | `signoutRedirect()` rejeita | landing com alerta de sessão não encerrada (ADR 0019) |
| Limite de 120 por minuto por origem em cada caminho da API | `429` | "Muitas tentativas"; `Retry-After` não é lido |
| API de conta fora do ar ou recusando | erro no GET da conta | `/app` não abre: mensagem, "tentar de novo" e "Sair" (ADR 0020) |

---

## §9. O fake não é o IdP

Os e2e rodam contra `dev/idp-fake/` (`oidc-provider`, ADR 0004), que difere do real em pontos
que o contrato toca:

- o fake ecoa qualquer `Origin`; o real só aceita a origem exata;
- o formulário de login é outro (`e2e/idp.ts` está acoplado ao do fake);
- o fake publica o logout em `/o/session/end`; o real, em `/o/logout/`. Nada disso quebra a SPA,
  porque ela lê o endpoint da descoberta;
- `name: ""` só sai do usuário `name-vazio` do fake; no real, de qualquer conta sem nome;
- o fake simula a API de conta em `/api/conta/` no mesmo processo, com CORS escrito à mão para
  `http://localhost:5173`, contas em memória e os logins `sem-aceite` e `nao-confirmado`; não
  aplica o teto de requisições nem `conta_inativa`;
- o fake retira `create` do `prompt` e segue ao login, sem página de cadastro (ADR 0020); as
  páginas `/accounts/…` não existem nele.

e2e verde prova o código, não a integração. A integração só vale quando o fluxo fecha contra o
IdP real (`../CLAUDE.md`).

---

## §10. Mudanças que exigem os dois lados

Cada item abaixo pede ADR nos dois projetos, uma apontando para a outra:

- troca de domínio ou de issuer do IdP (o issuer de produção está congelado pela ADR 0025 do IdP);
- rotação de chave ou mais de uma chave no JWKS;
- claim nova, claim removida ou mudança de semântica (por exemplo, `name` deixar de poder vir
  vazia);
- mudança de tempo de vida de token ou de política de refresh;
- nova origem da SPA (domínio próprio, alias de preview);
- caminho, corpo, código de erro ou destino de volta da API ou das páginas de conta (§11), e as
  rotas da SPA que o IdP conhece: `/`, `/app/conta`, `/termos`, `/privacidade`;
- scope novo ou retirado;
- troca da versão dos termos: decisão nos dois lados e janela em que o IdP aceite as duas
  versões; a SPA troca `TERMOS_VERSAO` e o texto em `src/termos.ts`. A janela sozinha não basta:
  a guarda só abre com a versão vigente (§11.4), e o critério de "aceito" durante a janela está
  em aberto, a decidir antes da primeira troca.

Ordem de implantação: o IdP primeiro, a SPA depois. A SPA que pede `conta` a um IdP sem esse
scope recebe `invalid_scope`, e ninguém entra.

---

## §11. Conta: API e páginas do IdP

### §11.1 API

Base: a origem do issuer; os caminhos não constam da descoberta. Todo caminho termina em barra.

| Método e caminho | Corpo | Sucesso |
|---|---|---|
| `GET /api/conta/` | — | `200`, corpo abaixo |
| `PATCH /api/conta/` | `first_name`, `last_name`, `nickname` (presentes; ausente não apaga; `null` vale `""`; sem nenhum deles, não grava e `updated_at` não muda) | `200`, mesmo corpo do GET |
| `POST /api/conta/confirmacao/` | — | `204` sempre, enviando ou não |
| `POST /api/conta/termos/` | `{"versao": "<texto>"}`, comparado sem `strip` | `204` |

Corpo do GET e do PATCH:

| Campo | Tipo | Observação |
|---|---|---|
| `sub` | string | UUID; igual ao `sub` das claims |
| `email` | string | minúsculas |
| `email_verified` | boolean | |
| `first_name`, `last_name`, `nickname` | string | podem ser `""` |
| `date_joined` | string ISO 8601 | |
| `updated_at` | string ISO 8601 | na claim é inteiro (§5); schemas separados |
| `senha_alterada_em` | string ISO 8601 ou `null` | `null` é "sem registro": conta anterior ao campo; a conta nova já nasce com a data |
| `termos_versao` | string | `""` se nunca aceitou |
| `termos_versao_vigente` | string | a versão vigente no IdP |

As datas saem do `isoformat()` em UTC (_Coordinated Universal Time_): sufixo `+00:00`, nunca `Z`,
e microssegundos só quando diferentes de zero. A SPA interpreta a data, não depende do tamanho.

### §11.2 Recusas e o que a SPA faz

| Resposta | O que a SPA faz |
|---|---|
| `401` (sem `Authorization`, desafio sem `error`; token vencido, revogado ou desconhecido, `error="invalid_token"`) | novo login com volta à página atual; trava por URL (ADRs 0008, 0020) |
| `403` `insufficient_scope` (só no desafio `WWW-Authenticate`, com `error_description` e `resource_metadata`, sem `scope`; sem `codigo` no corpo) | erro genérico, sem ramo (ADR 0020; premissas lá) |
| `403` `aplicacao_nao_autorizada` | erro genérico; a guarda fecha `/app` |
| `403` `conta_inativa` | na guarda, "Esta conta está desativada." só com "Sair" |
| `400` | mensagem por `codigo` (`max_length`, `invalid`, `termos_desatualizados`; `geral`/`json_invalido`), com a `mensagem` inglesa do IdP como reserva |
| `429` | mensagem por status; na guarda também, com "tentar de novo" e "Sair" |

O corpo do `400` é `{"erros": {"<campo>": [{"codigo": "...", "mensagem": "..."}]}}`.

O IdP expõe `WWW-Authenticate` e `Retry-After` ao `fetch`; a SPA hoje não lê nenhum dos dois, nem
o `resource_metadata` do desafio.

### §11.3 Páginas e voltas

| Página | Caminho | Volta à SPA |
|---|---|---|
| Cadastro | `/accounts/registrar/`, pelo `prompt=create` ou pelo link da tela de login do IdP; a SPA não cita o caminho, só usa `prompt=create` | `/o/authorize/` retomado → `/callback` |
| Recuperar senha | `/accounts/password_reset/` | link "Ir para a aplicação" para `{SPA_URL}/`; não abre sessão |
| Trocar senha | `/accounts/password_change/` | `/app/conta?aviso=senha-trocada` |
| Trocar e-mail | `/accounts/email/` | `/app/conta?aviso=email-trocado` |
| Excluir | `/accounts/excluir/` | `/?conta=desativada` ou `/?conta=apagada` |
| Link de confirmação | `GET /api/conta/confirmar/?t=` | `/?email=confirmado` ou `/?email=invalido` |

- "Cancelar" nas páginas leva a `/app/conta`.
- O cadastro tem links para `/termos` e `/privacidade`.
- A tela de aceite dos termos (`/app/termos`) tem link para a exclusão, para que recusar os
  termos não impeça excluir a conta.
- A SPA chega às páginas só por navegação de página inteira, nunca por `fetch`.
- Troca de senha, redefinição e exclusão revogam os tokens em todas as `Application`s, e a SPA
  descobre isso pelo `401`.

### §11.4 Termos

A guarda compara `termos_versao` com `termos_versao_vigente`, ambos do GET. O aceite envia
`TERMOS_VERSAO`, a versão exibida. Se divergir da vigente, o IdP responde
`termos_desatualizados`; sem `versao`, `required`.
