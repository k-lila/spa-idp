# Arquitetura da SPA

Mapa do projeto e desenho da SPA como relying party (RP) OIDC (OpenID Connect) do provedor de
identidade (IdP). As regras que o desenho cumpre (invariantes I1–I8) estão em
`docs/spa-nucleo.md`; o porquê de cada escolha, nas ADRs (Architecture Decision Records) de
`docs/adr/`.

---

## Árvore de arquivos

```
./
├── src/
│   ├── main.tsx              # boot: valida config, monta Query → Auth → Router
│   ├── config.ts             # lê e valida as VITE_* (ADR 0005)
│   ├── router.tsx            # rotas: /, /callback, /app (protegida), *
│   ├── index.css             # Tailwind v4
│   ├── auth/                 # tudo o que é OIDC
│   │   ├── userManager.ts    # único contato com oidc-client-ts: signin, completeSignin,
│   │   │                     #   signout, restoreSession (ADR 0006)
│   │   ├── idToken.ts        # único contato com jose: verifica o id_token (ADR 0013)
│   │   ├── claims.ts         # schema zod das claims sub, name, email (ADR 0007)
│   │   ├── AuthContext.ts    # tipo do estado (loading | anonymous | authenticated) e useAuth
│   │   ├── AuthProvider.tsx  # traduz eventos do UserManager em estado React
│   │   └── RequireAuth.tsx   # guarda de rota por redirect (I8)
│   ├── api/
│   │   ├── http.ts           # authGet: anexa Bearer, 401 → re-auth (ADR 0008)
│   │   ├── userinfo.ts       # useUserinfo, chaveado pelo sub (ADR 0009)
│   │   └── queryClient.ts    # cliente do TanStack Query
│   └── pages/
│       ├── Landing.tsx       # "Entrar"; aviso de logout que não chegou ao IdP
│       ├── Callback.tsx      # troca o code; autenticando | erro
│       ├── Area.tsx          # claims do id_token e do userinfo; "Sair"
│       └── NotFound.tsx
├── dev/idp-fake/server.js    # IdP fake (oidc-provider) para os e2e (ADR 0004)
├── e2e/                      # Playwright contra o IdP fake
├── docs/
│   ├── spa-nucleo.md         # stack e invariantes
│   ├── arquitetura.md        # este documento
│   └── adr/                  # decisões (0001–0019)
├── .github/workflows/ci.yml  # typecheck, lint, format, testes unitários
├── vercel.json               # rewrite para /index.html e cabeçalhos (ADR 0016)
├── vite.config.ts            # plugins React e Tailwind, porta 5173, Vitest
├── .env.example              # modelo das VITE_*
└── CLAUDE.md                 # regras de trabalho
```

Os testes unitários ficam ao lado do arquivo que testam (`*.test.ts[x]`).

---

## Arquitetura

### Contexto: duas origens, um navegador

A SPA é estática: a Vercel entrega HTML, JS e CSS, e nada roda no servidor. Todo o protocolo
acontece no navegador, contra o IdP em outra origem (Cloudflare Tunnel em produção, ADR 0018;
`http://localhost:8000/o` em desenvolvimento).

```
                 ┌──────────────────────── navegador ─────────────────────────┐
  Vercel ──HTML/JS──▶  SPA (https://<spa>)                                    │
                 │       │                                                    │
                 │       ├─ navegação ──▶ /o/authorize/      login, consentimento
                 │       ├─ navegação ──▶ end_session_endpoint   logout (ADR 0019)
                 │       ├─ fetch ──────▶ /.well-known/openid-configuration
                 │       ├─ fetch ──────▶ jwks_uri           chave pública RS256
                 │       ├─ fetch (CORS)▶ /o/token/          code + code_verifier → tokens
                 │       └─ fetch (CORS)▶ /o/userinfo/       Bearer access_token
                 └────────────────────────────────────────────────────────────┘
                                          │
                                  IdP (https://<idp>/o)
```

Duas naturezas de chamada:

- **Navegação de página inteira** (authorize, logout): a SPA é descarregada e o IdP assume a tela.
  A senha só é digitada ali (I1, I8). O cookie de sessão do IdP (`SameSite=Lax`) viaja nessas
  navegações, e é ele que devolve o usuário sem senha num novo login (SSO).
- **`fetch` cruzando origem** (descoberta, JWKS, token, userinfo): depende da allowlist de CORS
  (Cross-Origin Resource Sharing) do IdP conter a origem exata da SPA.

Só o issuer vem da configuração; todos os endpoints saem da descoberta (I5).

### Camadas

```
 pages/         Landing · Callback · Area            telas; não conhecem a biblioteca OIDC
    │
 auth/          AuthProvider · RequireAuth · useAuth estado React e guarda de rota
    │
 auth/          userManager.ts ──▶ oidc-client-ts    protocolo (único ponto de contato)
                idToken.ts ──────▶ jose              verificação criptográfica
                claims.ts ───────▶ zod               contrato das claims
    │
 api/           http.ts (authGet) · userinfo.ts      chamadas autenticadas
    │
 config.ts      VITE_OIDC_ISSUER, _CLIENT_ID, _REDIRECT_URI, _POST_LOGOUT_REDIRECT_URI
```

Cada biblioteca externa entra por um arquivo só. `User` e `access_token` não saem de
`userManager.ts` e `http.ts`: as telas recebem apenas as claims já validadas pelo contexto.

### Estado e onde ele vive

| O quê | Onde | Por quê |
|---|---|---|
| Tokens (`id_token`, `access_token`, `refresh_token`) | memória (`InMemoryWebStorage`) | I3; somem no reload |
| `state`, `nonce`, `code_verifier` | `sessionStorage` (padrão da lib), só durante o redirect | a página é descarregada; não são tokens |
| Marcador de re-auth (`spa.reauth`) | `sessionStorage` | corta o laço 401 → IdP → 401 (ADR 0008) |
| Estado de autenticação | `AuthContext` | `loading` → `anonymous` \| `authenticated` com claims |
| Resposta do userinfo | cache do TanStack Query, chave `["userinfo", sub]` | limpo quando a sessão acaba |

O `refresh_token` é recebido e nunca usado; não há renovação silenciosa (ADR 0014).

### Fluxos

**Login (authorization code + PKCE).**

1. "Entrar" (Landing) ou a guarda de `/app` (`RequireAuth`) chama `signin(returnTo?)`.
2. A biblioteca gera `code_verifier` e `nonce`, guarda o destino no `state` (ADR 0011) e navega
   a `/o/authorize/`.
3. O IdP autentica e volta a `/callback?code=…&state=…`.
4. `Callback` chama `completeSignin()`: a biblioteca confere o `state` e troca o `code` em
   `/o/token/`; `jose` verifica assinatura, `iss`, `aud`, `alg` e `exp` do `id_token` contra o
   JWKS (I4); zod valida as claims (I7). Qualquer falha descarta os tokens e mostra o erro.
5. `AuthProvider` recebe o evento `userLoaded`, passa a `authenticated`, e `Callback` navega ao
   destino, restrito à própria origem (ADR 0011).

**Reload.** A memória zera. `restoreSession()` responde "sem sessão"; em `/app` a guarda refaz o
login, e o SSO do IdP devolve o usuário sem pedir senha (ADR 0014).

**Userinfo.** `Area` chama `useUserinfo(sub)` → `authGet` anexa o `Bearer`. A resposta passa pelo
mesmo schema zod e precisa trazer o mesmo `sub` do `id_token` (ADR 0009). Um `401` dispara um novo
login, uma vez por aba; o segundo `401` seguido vira erro (ADR 0008).

**Logout.** "Sair" chama `signoutRedirect()` sem `state` (ADR 0019): a biblioteca esquece os
tokens, o cache do userinfo é limpo, e a página vai ao `end_session_endpoint`, que encerra a
sessão no IdP e volta a `/`. Se a navegação não sai, a landing avisa que a sessão no IdP
continua.

### Fronteiras de confiança

Nada que chega da rede é aceito pelo tipo estático:

- `id_token`: assinatura e claims de registro (`jose`), `nonce` (biblioteca), claims de
  identidade (zod).
- userinfo: zod e `sub` igual ao do `id_token`.
- destino pós-login: só caminho da própria origem.
- configuração: `config.ts` falha no boot se faltar ou for inválida alguma `VITE_*`.

O `access_token` da RP só lê identidade: `authGet` só faz `GET` (I1).

### Ambientes

| Ambiente | IdP | Uso |
|---|---|---|
| Produção | Vercel → IdP pelo Cloudflare Tunnel | variáveis no painel da Vercel (ADRs 0016, 0017) |
| Preview | nenhum | a aplicação falha no boot, deliberadamente (ADR 0016) |
| Desenvolvimento | IdP real em `http://localhost:8000/o` | `.env.local` |
| e2e | IdP fake em `http://localhost:9000/o` | `npm run test:e2e` sobe fake e SPA |

---

## Apêndice: índice das ADRs

Uma decisão por arquivo em `docs/adr/`; o formato está em `docs/adr/template-adr.md`. ADR
aceita é imutável: decisão que mudou vira ADR nova. As ADRs guardam o que se sabia e se decidiu
na data delas; este índice guarda o que ajuda a lê-las hoje (emendas, defasagens, eras). Uma ADR
aceita só é editada para restabelecer a verdade: em 2026-09-29, as referências a documentos de
trabalho que não existem mais (plano de pré-implementação, contratos de front-end e de back-end,
roteiro de implementação, mapa de comportamento do back-end) e os ponteiros "§N" e "etapa N"
foram suprimidos, sem mudar decisão. Cada ADR editada traz, sob o status, uma linha de revisão.
"O plano", sem número, continua citado como o documento de trabalho da época.

| Decisão | ADR | Leitura hoje | Revisões depois do aceite |
|---|---|---|---|
| Fixar npm e Node 22 LTS como base de ferramentas | `0001-fixar-npm-e-node-22-como-base-de-ferramentas.md` | engines apertado pela 0016 | supressão de referências voláteis (2026-09-29) |
| Adotar Tailwind CSS v4 pelo plugin oficial do Vite | `0002-adotar-tailwind-v4-pelo-plugin-do-vite.md` | — | — |
| Usar React Router v7 como biblioteca, em modo data router | `0003-usar-react-router-v7-como-biblioteca-em-modo-data-router.md` | — | supressão de referências voláteis (2026-09-29) |
| Rodar o IdP fake local com `oidc-provider` em JavaScript ESM, montado em `/o` | `0004-rodar-idp-fake-local-com-oidc-provider-em-javascript.md` | cláusula do logout do fake emendada pela 0019; escrita na era Render, superada pela 0018 | supressão de referências voláteis (2026-09-29) |
| Validar as variáveis `VITE_*` no boot em `src/config.ts`, sem zod | `0005-validar-variaveis-de-ambiente-no-boot-em-config-ts.md` | contagem de variáveis alterada pela 0012 (três) e pela 0019 (quatro) | supressão de referências voláteis (2026-09-29) |
| Integrar o `oidc-client-ts` v3 por um `UserManager` único, com tokens em memória e estado de redirect em `sessionStorage` | `0006-integrar-oidc-client-ts-com-tokens-em-memoria.md` | defasada pela 0014 (sessão no reload) e pela 0013 (verificação) | supressão de referências voláteis (2026-09-29) |
| Validar as claims do `id_token` com zod em dois portões e expor ao contexto só claims validadas | `0007-validar-claims-do-id-token-com-zod-e-expor-so-claims-validadas-no-contexto.md` | — | supressão de referências voláteis (2026-09-29) |
| Anexar o Bearer e converter 401 em re-auth num wrapper GET-only em `src/api/http.ts`, mantendo a requisição pendente e com guarda de uma re-auth por aba | `0008-anexar-bearer-e-converter-401-em-re-auth-num-wrapper-get-em-api-http.md` | — | supressão de referências voláteis (2026-09-29) |
| Consumir o `userinfo` com TanStack Query v5, chaveado pelo `sub` do `id_token` e validado pelo schema de claims | `0009-consumir-o-userinfo-com-tanstack-query-chaveado-pelo-sub-e-validado-pelo-schema-de-claims.md` | — | supressão de referências voláteis (2026-09-29) |
| Sair localmente com `removeUser()` e disparar a guarda de rota só na entrada sem sessão, nunca na perda de sessão com a guarda montada | `0010-sair-localmente-com-removeuser-e-disparar-a-guarda-so-na-entrada-sem-sessao.md` | **substituída pela 0019** | supressão de referências voláteis (2026-09-29) |
| Levar o destino do deep-link no `state` do `signinRedirect` e aceitar no callback só caminho da própria origem, resolvido por `URL` | `0011-levar-o-destino-do-deep-link-no-state-do-signinredirect-e-aceitar-so-caminho-da-propria-origem.md` | — | supressão de referências voláteis (2026-09-29) |
| Retirar as páginas de conta do escopo da SPA e remover `VITE_IDP_ACCOUNT_URL` (emenda a D2) | `0012-retirar-as-paginas-de-conta-do-escopo-e-remover-vite-idp-account-url.md` | par com a 0023 do IdP | troca de nomes de diretório pelo papel (56c1ee6, 2026-09-29); supressão de referências voláteis (2026-09-29) |
| Verificar o `id_token` com `jose` em `completeSignin()` — assinatura via `jwks_uri`, `iss` exato, `aud`, RS256 e `exp` — e dar I4 por cumprido | `0013-verificar-o-id-token-com-jose-em-completesignin-e-fechar-i4.md` | defasada pela 0014 nas entradas futuras por `_buildUser` | troca de nomes de diretório pelo papel (56c1ee6, 2026-09-29); supressão de referências voláteis (2026-09-29) |
| Manter a sessão no reload por redirect ao IdP e SSO, sem token fora da memória, e fechar a questão da sessão no reload | `0014-manter-a-sessao-no-reload-por-redirect-e-sso-do-idp-sem-token-fora-da-memoria.md` | par com a 0021 do IdP | troca de nomes de diretório pelo papel (56c1ee6, 2026-09-29); supressão de referências voláteis (2026-09-29) |
| Fixar `requestTimeoutInSeconds` em 15 s no `UserManager` | `0015-fixar-requesttimeoutinseconds-em-15-s-no-usermanager.md` | escrita na era AWS/Render, superada pela 0018 | supressão de referências voláteis (2026-09-29) |
| Publicar a SPA na Vercel com `vercel.json`, variáveis por ambiente no painel e previews sem IdP de produção | `0016-publicar-na-vercel-com-vercel-json-variaveis-por-ambiente-e-previews-sem-idp-de-producao.md` | escrita na era AWS, superada pela 0018; par com a 0022 do IdP; variável nova pela 0019 | troca de nomes de diretório pelo papel (56c1ee6, 2026-09-29); supressão de referências voláteis (2026-09-29) |
| Fixar `VITE_OIDC_ISSUER` de produção na forma `https://<dominio-do-idp>/o`, sem barra final | `0017-fixar-vite-oidc-issuer-de-producao-em-https-dominio-do-idp-barra-o-sem-barra-final.md` | escrita na era AWS, superada pela 0018; par com a 0007 e a 0025 do IdP | troca de nomes de diretório pelo papel (56c1ee6, 2026-09-29); supressão de referências voláteis (2026-09-29) |
| Aceitar o IdP de produção servido pelo Cloudflare Tunnel com o contrato inalterado | `0018-aceitar-o-idp-de-producao-servido-pelo-cloudflare-tunnel-com-o-contrato-inalterado.md` | par com a 0027 do IdP | — |
| Sair por logout iniciado pela RP com `signoutRedirect()` sem `state`, mantendo a guarda disparada só na entrada sem sessão | `0019-sair-por-logout-iniciado-pela-rp-com-signoutredirect-sem-state.md` | substitui a 0010; emenda a cláusula do fake na 0004; par com a 0029 do IdP | troca de nomes de diretório pelo papel (56c1ee6, 2026-09-29) |

### Pares com o IdP

| Tema | SPA | IdP |
|---|---|---|
| Issuer | 0017 | 0007, 0025 |
| Sessão no reload e consentimento | 0014 | 0021 |
| Páginas de conta | 0012 | 0023 |
| CORS e previews | 0016 | 0022 |
| Túnel da Cloudflare | 0018 | 0027 |
| Logout pela RP | 0019 | 0029, 0030 |

Quem decidiu depois cita quem decidiu antes; a citação mútua só existe nos pares aceitos no
mesmo ato. Este índice registra o par nos dois sentidos.
