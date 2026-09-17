# Contrato do front-end — o que a `nova_api_SPA` deve cumprir para integrar o `nova_api`

| Campo | Valor |
| --- | --- |
| Destinatário | projeto `nova_api_SPA` (relying party, RP) |
| Contraparte | projeto `nova_api` (provedor de identidade, IdP), que recebe o `contrato-backend.md` |
| Origem | levantamento de 2026-09-16 (`contrato-geral.md`, `desavencas-parciais.md`, `desavencas.md`, na raiz `idp/`) |
| Ambientes | produção: SPA na Vercel, IdP na AWS (prioritário) · desenvolvimento: tudo em `localhost` |
| Critério de pronto | a checklist da seção 9 inteira marcada |

Este documento diz **o que** a SPA precisa preservar, implementar, configurar e decidir para
fechar o fluxo OpenID Connect (OIDC) contra o IdP real — não contra o fake de `dev/idp-fake/`.
**Como** fazer cada item é decisão do projeto, dentro das próprias regras (`CLAUDE.md`,
invariantes I1–I8 de `docs/spa-nucleo.md`, ADRs — Architecture Decision Records — imutáveis,
relatório antes de alterar código). Onde este documento pede uma decisão, a recomendação vem
com a razão; a decisão em si é registrada em ADR (seção 8).

---

## 1. Quem é a contraparte

O IdP é um monólito Django com `django-oauth-toolkit` (DOT), em origem diferente da SPA:
`https://<dominio-do-idp>` na AWS em produção, `http://localhost:8000` em desenvolvimento. Ele:

- tem issuer `{BASE_URL}/o` e descoberta em `{issuer}/.well-known/openid-configuration`;
- exige PKCE (Proof Key for Code Exchange) `S256`; recusa `plain` e pedido sem
  `code_challenge`;
- compara `redirect_uri` por **igualdade exata** (esquema, host, porta, path, barra final);
- aceita cliente público em `/o/token/` sem secret; o endpoint é chamável do navegador **desde
  que a origem da SPA esteja na allowlist de CORS** (Cross-Origin Resource Sharing) — que
  hoje está vazia e será preenchida pelo IdP com a origem que a SPA entregar;
- emite `id_token` RS256 com `sub` (string), `name` (**pode ser `""`**), `email`, mais `iss`,
  `aud`, `exp`, `iat`, `nonce`; **não** emite `email_verified`; publica uma chave RSA com `kid`
  em `jwks_uri`;
- responde `GET /o/userinfo/` com as mesmas claims; token inválido → **401**;
- **não** publica `end_session_endpoint` (logout pela RP desligado, por decisão);
- emite `refresh_token` que não expira e é rotacionado a cada uso — a SPA não o usa;
- `access_token` e `id_token` valem 10 h; `code` vale 60 s;
- mantém sessão própria por cookie `SameSite=Lax`: uma navegação top-level a `/o/authorize/`
  de outra origem chega com o cookie, e a volta é sem senha (SSO);
- limita `/o/authorize/` e `/o/token/` a 120 requisições por minuto por origem de rede
  (responde 429, com cabeçalhos de CORS);
- **não** tem páginas de cadastro nem de edição de perfil; contas são criadas pelo admin;
- vai marcar `skip_authorization` na `Application` da SPA, para que a tela de consentimento não
  apareça a cada reload (ver seção 2.2).

O que o IdP publica para RPs está em `nova_api/docs/integracao-rp.md`. Este documento é a
versão conferida contra o código dos dois lados.

---

## 2. Diferenças entre o IdP real e o fake

O fake (`oidc-provider`) foi fiel ao contrato na maior parte, mas a SPA foi verificada em
quatro comportamentos que o IdP real **não** tem. Cada um deles precisa ser exercitado de novo
contra o real.

### 2.1 CORS restrito de verdade

O fake ecoa qualquer `Origin` em descoberta e JWKS. O IdP real só responde com
`Access-Control-Allow-Origin` para a origem exata da allowlist, nos quatro caminhos
(descoberta, `jwks_uri`, `/o/token/`, `/o/userinfo/`). Um erro de CORS aparece no navegador
como falha de rede, sem status — a SPA já trata isso como estado de erro do callback.

### 2.2 Tela de consentimento

O DOT pede consentimento em **toda** ida a `/o/authorize/` por default (o fake devolvia sem
prompt depois do primeiro login). Como a SPA vai ao IdP em todo reload, a pessoa veria a tela a
cada F5. O IdP vai marcar `skip_authorization=True` na `Application` da SPA; até lá, ou se a
marcação faltar, a SPA precisa **tolerar** a tela (ela já tolera: é só um passo a mais no
redirect) e não presumir volta silenciosa.

### 2.3 Formulário de login diferente

O login do IdP é o `LoginView` do Django: campos `username` (que recebe o e-mail) e `password`,
seguido do template `oauth2_provider/authorize.html` quando há consentimento. O helper de e2e
`e2e/idp.ts` está acoplado ao formulário do fake (`input[name=login]`, "Sign-in", "Continue") e
**não funciona** contra o real. Os e2e automatizados podem continuar no fake; a validação contra
o real é manual ou com um segundo helper.

### 2.4 Claims reais

O fake só emite `name: ""` no login `name-vazio`. No IdP real, qualquer conta sem nome e
sobrenome emite `""` — o schema já aceita, mas a `Area` renderiza em branco sem fallback.
`sub` é a chave primária numérica como string (`"1"`, `"2"`…), não um login.

---

## 3. O que já está certo e não pode mudar

Verificado no código da SPA e é exatamente o que o IdP espera:

| Item | Como está | Onde |
| --- | --- | --- |
| `authority` = issuer; endpoints pela descoberta | I5 | `src/auth/userManager.ts` |
| `response_type: "code"`, PKCE `S256` (default da lib) | I2 | idem |
| `scope: "openid profile email"`, fixo | contrato | `src/config.ts` |
| `nonce` por chamada (`crypto.randomUUID()`), `state` pela lib | I4 parcial | `signin()` |
| Tokens só em memória (`InMemoryWebStorage`); `stateStore` em `sessionStorage` só durante o redirect | I3, ADR 0006 | `userManager.ts` |
| `automaticSilentRenew`, `monitorSession`, `loadUserInfo` = `false` | sem iframe, sem refresh | idem |
| Schema de claims: `sub` ≥ 1, `name` string (vazio ok), `email` ≥ 1, extras descartadas | ADR 0007 | `src/auth/claims.ts` |
| `userinfo`: `GET` com `Bearer` no endpoint da descoberta; 401 → re-auth uma vez por aba; `sub` conferido com o do `id_token` | ADRs 0008, 0009 | `src/api/http.ts`, `src/api/userinfo.ts` |
| Logout local com aviso de que a sessão no IdP continua | ADR 0010 | `src/pages/Area.tsx` |
| Deep-link no `state`, aceito só se for caminho da própria origem | ADR 0011 | `userManager.ts` |
| Erro no callback (`error` sem `code`, `state` inválido, rede) → estado de erro com volta a `/` | plano §2 | `src/pages/Callback.tsx` |

---

## 4. O que o IdP precisa receber deste projeto

Por ambiente, os valores **literais** (esquema, host, porta, path, sem barra final):

| Valor | Produção | Desenvolvimento |
| --- | --- | --- |
| Origem da SPA (para o CORS do IdP) | `https://<spa>` | `http://localhost:5173` |
| `redirect_uri` (para a `Application` do IdP) | `https://<spa>/callback` | `http://localhost:5173/callback` |

E, se a SPA quiser autenticar em preview da Vercel: um **alias estável** (branch domain ou
domínio próprio de preview), que ganha uma terceira `Application` no IdP. Previews sem alias
não autenticam — renderizam a landing e "Entrar" falha, comportamento já existente.

O que este projeto **recebe** do IdP, por ambiente: o `issuer` (`https://<dominio-do-idp>/o`
em produção, `http://localhost:8000/o` em dev) e o `client_id` de cada `Application`. O
`contrato-backend.md` pede ao IdP que os entregue.

---

## 5. O que implementar

### 5.1 Verificar o `id_token` (fecha o invariante I4)

`oidc-client-ts` 3.5.0 valida só `sub` e `nonce`. **Não** verifica assinatura, `iss`, `aud`
nem `exp` (fato verificado em `.claude/memory/decisions.md`, TASK-003; o plano §7.1 afirmava o
contrário e precisa de emenda). O IdP publica tudo que é preciso para verificar; a SPA não usa.

Esperado: depois de `signinRedirectCallback()`, em `completeSignin()`, verificar o `id_token`
com `jose`:

- assinatura contra o JWKS lido de `metadataService.getKeysEndpoint()`
  (`createRemoteJWKSet`, que recarrega ao ver `kid` desconhecido — é o que sobrevive à rotação
  de chave do IdP);
- `issuer` = `config.oidc.issuer`, por igualdade exata (a barra final em `VITE_OIDC_ISSUER`
  passa a importar);
- `audience` = `config.oidc.clientId`;
- `algorithms: ["RS256"]`;
- `exp`, com `clockTolerance` de alguns segundos.

Falha em qualquer ponto → `removeUser()` e estado de erro do callback, como já acontece com
claims malformadas. `nonce` continua com a biblioteca.

Por que não relaxar I4 por ADR: a OIDC Core §3.1.3.7 permite dispensar a assinatura quando o
token chega por TLS direto do token endpoint, mas isso transfere toda a confiança para DNS + CA
+ o valor de `VITE_OIDC_ISSUER`, e deixa `iss`, `aud` e `exp` sem verificação nenhuma — pelo
mesmo custo da chamada que verifica tudo.

### 5.2 `vercel.json`

O IdP redireciona para `https://<spa>/callback?code=…&state=…`. `/callback` é rota do React
Router, não arquivo em `dist/`; sem rewrite, a Vercel responde 404 e o `code` morre. Esperado:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

`Referrer-Policy: no-referrer` porque a URL de `/callback` carrega `code` e `state`; sem ele,
qualquer recurso externo carregado por aquela página receberia a URL inteira no `Referer`.
Hash router não é alternativa: a RFC 6749 §3.1.2 proíbe fragmento na `redirect_uri`.

### 5.3 Retirar a dependência de páginas de conta (emenda a D2)

O IdP **não tem** cadastro nem edição de perfil, e não os terá nesta fase (cadastro público num
IdP exposto exige política de senha, limite de taxa e verificação de e-mail antes). Esperado:

- `VITE_IDP_ACCOUNT_URL` deixa de ser obrigatória (opcional ou removida de `src/config.ts` e
  do `.env.example`);
- "Registrar-se" (landing) e "Editar perfil" (`/app`), previstos no plano §2, saem do plano por
  emenda; hoje nem existem no código, então é só não os criar;
- ADR registrando a emenda a D2 (seção 8).

### 5.4 Fechar "sessão no reload" (plano §7.2)

Esperado: **manter o desenho atual** — boot sem sessão em rota protegida redireciona ao IdP,
que devolve por SSO — e registrar isso como o mecanismo, por ADR. Nada de token fora da
memória: a alternativa (`sessionStorage`) gravaria um `refresh_token` que no IdP não expira nem
é revogado ao desativar a conta; um XSS ganharia acesso permanente.

Junto, dois ajustes apontados em `decisions.md` que ficam visíveis contra o IdP real:

- `Landing` trata `loading` como `anonymous` e mostra "Entrar" por um instante antes de
  redirecionar para `/app`; distinguir os dois estados;
- `requestTimeoutInSeconds` no `UserManager`: um IdP lento ou fora do ar pendura o clique em
  "Entrar" sem feedback, e o segundo clique devolve a mesma promessa memoizada.

### 5.5 Tolerar o IdP real

- Consentimento (seção 2.2): nenhuma suposição de volta silenciosa; o fluxo já é um redirect
  top-level e funciona com ou sem a tela.
- 429 do limitador: hoje cai no erro genérico do callback ou do userinfo. Aceitável; não
  retentar automaticamente (a retentativa alimentaria o próprio limite).
- `name` vazio: decidir a UX da `Area` (em branco, ou texto como "sem nome"), sem mexer no
  schema.

---

## 6. Configuração por ambiente

### 6.1 Desenvolvimento: contra o IdP real local

A regra da raiz: a SPA só está integrada quando fecha contra o IdP real. O IdP vai rodar em
`http://localhost:8000` (texto claro, loopback — aceitável em dev e evita instalar a CA local do
Caddy no navegador).

`.env.local`:

```
VITE_OIDC_ISSUER=http://localhost:8000/o
VITE_OIDC_CLIENT_ID=<client_id da Application de dev, entregue pelo IdP>
VITE_OIDC_REDIRECT_URI=http://localhost:5173/callback
```

O fake continua disponível (`npm run idp`) para os e2e automatizados e para trabalhar sem o
IdP de pé; o `.env.example` pode seguir apontando para ele, desde que o comentário diga como
apontar para o real.

### 6.2 Produção: Vercel

- Variáveis **no painel da Vercel, por ambiente**. Production: issuer e `client_id` de produção,
  `VITE_OIDC_REDIRECT_URI=https://<spa>/callback`. Preview: nada (a build falha, o que é
  desejável) ou os valores do cliente de preview, se houver alias. Development: os do IdP
  local. Nunca o mesmo valor nos três. Nada commitado (I6): um `.env.production` no
  repositório seria carregado também pelos previews.
- Node 22 fixado no projeto da Vercel (ela não lê `.nvmrc`, e `engines >=22.13` permite build
  em Node 24, que nenhum teste exercitou).
- Gate de CI (`typecheck`, `lint`, `test`) antes do deploy de produção; deploy de produção só
  a partir da branch principal.
- Previews: seção 4. Não pedir ao IdP regex de `*.vercel.app` — é domínio compartilhado por
  todos os usuários da Vercel.
- Depois de publicado, conferir a elegibilidade de bfcache do documento na origem real
  (`decisions.md` apontou que a ADR 0010 foi verificada com bfcache forçado).

---

## 7. Como verificar que a parte do front-end está cumprida

Em desenvolvimento, contra `http://localhost:8000` (com o IdP tendo cumprido a parte dele:
CORS, `Application`, `skip_authorization`):

1. "Entrar" na landing leva ao formulário de login do Django; após login, volta a `/app` com
   `sub`, `name`, `email` do `id_token` **e** do `userinfo` renderizados.
2. Segundo login (ou reload de `/app`) volta sem senha e sem tela de consentimento.
3. Conta sem nome: `name` = `""` entra normalmente.
4. `id_token` adulterado, ou `VITE_OIDC_ISSUER` com barra final: o callback cai no estado de
   erro (prova de que a verificação da seção 5.1 está ativa).
5. Deep-link: abrir `/app?x=1` sem sessão → login → volta a `/app?x=1`.
6. "Sair" → `/`; "Entrar" de novo volta sem senha (SSO do IdP), com o aviso na tela.
7. Com o IdP derrubado, "Entrar" mostra "Não foi possível iniciar o login" em tempo finito.

Em produção, com a SPA publicada e o IdP na AWS: o item 1 fecha em `https://<spa>`, e
`https://<spa>/callback` carregado diretamente responde a SPA (não 404 da Vercel).

---

## 8. Decisões a registrar em ADR (uma aqui, uma no IdP, apontando uma para a outra)

| Decisão | Referência no IdP |
| --- | --- |
| Verificação do `id_token` com `jose` (I4 cumprido; emenda ao plano §7.1) | `integracao-rp.md` §7 (o que a RP verifica) |
| Sessão no reload por redirect + SSO (fecha §7.2) | ADR do IdP sobre `skip_authorization` |
| Emenda a D2: sem páginas de conta; `VITE_IDP_ACCOUNT_URL` removida (ADR 0012) | ADR do IdP "sem páginas de conta nesta fase" |
| `VITE_OIDC_ISSUER` de produção fixado em `https://<dominio-do-idp>/o` | ADR do IdP congelando o issuer (ADR 0007) |
| Deploy na Vercel: `vercel.json`, variáveis por ambiente, previews sem IdP de produção | ADR do IdP sobre CORS por origem exata |

---

## 9. Checklist do front-end

Marcar cada item só quando verificado contra o código ou contra o ambiente, nunca contra um
documento.

### Código

- [x] `jose` integrado em `completeSignin()`: assinatura via `jwks_uri` da descoberta,
      `issuer`, `audience`, `RS256`, `exp` com tolerância; falha → `removeUser()` + erro do
      callback; teste unitário cobrindo token adulterado, `iss` errado, `aud` errado, expirado
- [ ] `vercel.json` com rewrite universal, `Referrer-Policy: no-referrer` e
      `X-Content-Type-Options: nosniff`
- [x] `VITE_IDP_ACCOUNT_URL` removida (ADR 0012); `.env.example` e `config.test.ts` ajustados
- [ ] `Landing` distingue `loading` de `anonymous`
- [ ] `requestTimeoutInSeconds` configurado no `UserManager`
- [ ] UX de `name` vazio decidida na `Area`
- [ ] Plano §7.1 emendado (a lib não valida `iss`/`aud`/`exp`); §2 sem "Registrar-se" e
      "Editar perfil"; §7.2 e §7.3 marcados como decididos

### Desenvolvimento

- [ ] Entregue ao IdP: `http://localhost:5173` (origem) e `http://localhost:5173/callback`
      (`redirect_uri`)
- [ ] `.env.local` apontando para `http://localhost:8000/o` com o `client_id` de dev
- [ ] Verificação manual da seção 7, itens 1–7, contra o IdP real local
- [ ] e2e no fake continuam verdes (o fake não foi alterado para fingir o IdP real)

### Produção

- [ ] Entregue ao IdP: `https://<spa>` (origem) e `https://<spa>/callback` (`redirect_uri`);
      alias de preview, se houver
- [ ] Variáveis definidas no painel da Vercel, por ambiente; Preview sem os valores de
      produção
- [ ] Node 22 fixado no projeto da Vercel
- [ ] CI com `typecheck`, `lint`, `test` como gate do deploy de produção
- [ ] `https://<spa>/callback` carregado diretamente responde a SPA, não 404
- [ ] Login em produção chega a `/app` com claims do `id_token` e do `userinfo`
- [ ] bfcache conferido na origem publicada

### Registro

- [x] ADR: verificação do `id_token` com `jose` (I4), com referência ao `integracao-rp.md`
- [ ] ADR: sessão no reload por redirect + SSO (§7.2), com referência à ADR do IdP
- [x] ADR: emenda a D2 (sem páginas de conta), com referência à ADR do IdP
- [ ] ADR: issuer de produção fixado, com referência à ADR do IdP
- [ ] ADR: deploy na Vercel e política de previews, com referência à ADR de CORS do IdP
