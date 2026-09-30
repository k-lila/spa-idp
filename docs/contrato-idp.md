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

| Ambiente | Issuer |
|---|---|
| Produção | `https://<dominio-do-idp>/o`, servido pelo Cloudflare Tunnel (ADR 0018; ADR 0027 do IdP) |
| Desenvolvimento | `http://localhost:8000/o` |
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
| `redirect_uris` | `https://<spa>/callback` · `http://localhost:5173/callback` |
| `post_logout_redirect_uris` | `https://<spa>/` · `http://localhost:5173/`, **com** a barra final |

As duas URIs são comparadas por **igualdade exata** (esquema, host, porta, path, barra final).
O admin do IdP não valida `post_logout_redirect_uris`: um cadastro errado só aparece no primeiro
"Sair".

Além da `Application`, a origem exata da SPA (`https://<spa>`, `http://localhost:5173`, sem
barra) entra em `CORS_ALLOWED_ORIGINS` do IdP. A allowlist governa só `/o/token/` e
`/o/userinfo/`; descoberta e JWKS respondem a qualquer origem (ADR 0022 do IdP).

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

O scope não varia por ambiente: `openid profile email`, fixo em `src/config.ts`.

---

## §4. O fluxo, endpoint a endpoint

| Endpoint | Como a SPA chama | O que envia | Onde |
|---|---|---|---|
| authorize | navegação de página inteira | `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state` (gerado pela biblioteca), `code_challenge` com `S256`, `nonce` novo a cada chamada | `signin()` em `userManager.ts` |
| token | `fetch` com CORS | `code`, `code_verifier`, `redirect_uri`, `client_id`; sem secret | `completeSignin()` |
| jwks | `fetch` | nada | `remoteJwks()` em `src/auth/idToken.ts` |
| userinfo | `fetch` com CORS, só `GET` | `Authorization: Bearer <access_token>` | `authGet()` em `src/api/http.ts`, `fetchUserinfo()` em `src/api/userinfo.ts` |
| end_session | navegação de página inteira | `post_logout_redirect_uri` e `id_token_hint` (`client_id` só na falta do hint); **sem** `state` | `signout()` (ADR 0019) |

- **Volta do authorize:** `/callback?code=…&state=…`. A biblioteca confere o `state`. Com `error`
  no lugar de `code`, o `Callback` mostra o estado de erro.
- **Logout:** `signoutRedirect()` não recebe argumentos; a biblioteca acrescenta sozinha o
  `id_token` em memória como `id_token_hint`. Com o hint vivo, o IdP encerra a sessão, revoga os
  tokens da conta **nesta** `Application` e volta a `/` sem pedir confirmação (ADR 0029 do IdP).

---

## §5. Claims

| Claim | Contrato do IdP | O que a SPA faz |
|---|---|---|
| `sub` | chave primária da conta, string | exige não vazia; é a chave do cache do userinfo |
| `name` | `get_full_name()`, **pode ser `""`** | aceita vazia; a `Area` mostra "(sem nome)" |
| `email` | identificador de login | exige não vazia; só exibe |

O schema está em `src/auth/claims.ts` (zod, ADR 0007). Claims extras (`iat`, `auth_time`, `sid`,
…) são toleradas e descartadas. O mesmo schema valida o `id_token` e o userinfo, e o `sub` do
userinfo tem de ser igual ao do `id_token` (ADR 0009).

O IdP **não** emite `email_verified`, nem grupos ou papéis. A SPA não decide nada a partir do
`email`: ele só é exibido. A chave de identidade é o par `(iss, sub)`, e o `sub` é reciclado se o
banco do IdP for recriado (`integracao-rp.md` §1).

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
| `access_token` | 10 h | usa até o IdP recusar; um `401` refaz o login uma vez por aba (ADR 0008) |
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

---

## §9. O fake não é o IdP

Os e2e rodam contra `dev/idp-fake/` (`oidc-provider`, ADR 0004), que difere do real em pontos
que o contrato toca:

- o fake ecoa qualquer `Origin`; o real só aceita a origem exata;
- o formulário de login é outro (`e2e/idp.ts` está acoplado ao do fake);
- o fake publica o logout em `/o/session/end`; o real, em `/o/logout/`. Nada disso quebra a SPA,
  porque ela lê o endpoint da descoberta;
- `name: ""` só sai do usuário `name-vazio` do fake; no real, de qualquer conta sem nome.

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
- nova origem da SPA (domínio próprio, alias de preview).
