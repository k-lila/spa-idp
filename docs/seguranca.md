# Segurança e modelo de ameaças

O que a SPA protege, contra quem, e o que ficou em aberto. A SPA é uma relying party (RP) OIDC
(OpenID Connect) do provedor de identidade (IdP); o contrato entre os dois está em
`docs/contrato-idp.md`, e a segurança do lado do IdP, em `docs/seguranca.md` do IdP.

---

## §1. Premissa

A SPA é estática: a Vercel serve HTML, JS e CSS, e não há servidor nem segredo da SPA. Todo o
protocolo roda no navegador da pessoa, e tudo o que a SPA guarda está nesse navegador. Por isso
o ativo a proteger é pequeno: os tokens da sessão em curso e a identidade exibida. A senha nunca
passa pela SPA.

A escrita na conta depende de uma premissa do IdP: a API de conta é isenta de proteção contra
falsificação de requisição entre sites (CSRF) só porque não aceita sessão, apenas o Bearer (ADR
0031 do IdP). A SPA não envia cookie a ela. Se a API passar a aceitar sessão, a isenção vira
falha, e a mudança pede ADR nos dois lados.

---

## §2. Controles implementados

| Controle | Contra o quê | Onde | Decisão |
|---|---|---|---|
| Authorization code + PKCE (Proof Key for Code Exchange) `S256` | `code` interceptado trocado por terceiro | `oidc-client-ts`, `src/auth/userManager.ts` | I2, ADR 0006 |
| `state` conferido pela biblioteca | CSRF (cross-site request forgery) no callback, login forçado | idem | I2 |
| `nonce` novo a cada `signin()` e `signup()` | replay e injeção de `id_token` | `signin()` e `signup()` | I4 |
| Assinatura RS256, `iss` exato, `aud`, `exp` com `jose` | token forjado, de outro IdP ou de outra RP | `src/auth/idToken.ts` | I4, ADR 0013 |
| Claims validadas com zod; tokens descartados em qualquer falha | identidade malformada tratada como válida | `src/auth/claims.ts`, `completeSignin()` | I7, ADR 0007 |
| `sub` do userinfo igual ao do `id_token` | resposta de outra identidade | `src/api/userinfo.ts` | ADR 0009 |
| Tokens só em memória (`InMemoryWebStorage`) | leitura de token persistido; token que sobrevive à aba | `userManager.ts` | I3, ADR 0014 |
| Sem renovação silenciosa e sem iframe de sessão | uso do `refresh_token`; iframe entre sites | `userManager.ts` | ADR 0014 |
| Destino pós-login só na própria origem | redirect aberto por `returnTo` (`//host`, `/\host`) | `internalPath()` em `userManager.ts` | ADR 0011 |
| Escrita só na API de conta, com o scope `conta`; o IdP a restringe ao `client_id` da SPA (`aplicacao_nao_autorizada`) e ao scope (`insufficient_scope`) | escrita no diretório fora da própria conta; token de outra RP na API | `src/api/http.ts`, `config.idp` | I1, ADRs 0008, 0020 |
| Um só novo login por `401` em cada URL, por aba | laço infinito de redirect | `spa.reauth` em `http.ts` | ADRs 0008, 0020 |
| Caminhos do IdP montados só em `config.ts`, sobre a origem do issuer | URL do IdP espalhada ou trocada no código | `config.idp` em `src/config.ts` | I5, ADR 0020 |
| `sub` da conta igual ao do `id_token` | resposta de outra identidade | `src/api/conta.ts` | ADRs 0009, 0020 |
| Avisos de query: só valores conhecidos viram texto, e são retirados da URL | texto arbitrário injetado pela URL | `Landing`, `Conta` | ADR 0020 |
| Guarda de termos: `/app` só abre com o GET da conta | área aberta sem aceite dos termos vigentes | `src/auth/RequireTermos.tsx` | ADR 0020 |
| Nenhum campo de senha; guarda de rota por redirect | coleta de credencial pela SPA | `src/auth/RequireAuth.tsx` | I1, I8 |
| Endpoints só pela descoberta; config validada no boot | endpoint trocado no código; boot com config ausente | `src/config.ts` | I5, I6, ADR 0005 |
| Previews sem variáveis e sem cliente no IdP | deploy de branch arbitrário recebendo tokens | painel da Vercel | ADR 0016 |
| "Sair" pelo `end_session_endpoint` com `id_token_hint` | sessão do IdP viva depois de sair; tokens válidos no IdP | `signout()` | ADR 0019 |
| Timeout de 15 s na descoberta e no token | tela presa com o IdP fora do ar | `requestTimeoutInSeconds` | ADR 0015 |
| `Referrer-Policy: no-referrer` | `code` e `state` de `/callback` vazando pelo `Referer` | `vercel.json` | ADR 0016 |
| `X-Content-Type-Options: nosniff` | resposta interpretada com tipo errado | `vercel.json` | ADR 0016 |
| Só roda em contexto seguro (`https` ou `localhost`) | PKCE e verificação sem `crypto.subtle` | navegador | `README.md` |
| React sem `dangerouslySetInnerHTML` nem `innerHTML` | XSS (cross-site scripting) por dado renderizado | `src/` | — |
| CI com `permissions: contents: read` | job de CI com escrita no repositório | `.github/workflows/ci.yml` | — |

---

## §3. Modelo de ameaças

| Ator | O que alcança | O que mitiga | Resta |
|---|---|---|---|
| **Script injetado** (XSS direto ou dependência npm comprometida) | tudo o que a página alcança: tokens em memória, `sessionStorage`, chamadas em nome da pessoa, e escrever na própria conta (nome, aceite dos termos, reenvio); senha e e-mail ficam em páginas do IdP | React escapa o que renderiza; nenhum HTML vindo da rede é injetado | é a ameaça dominante; sem CSP (§4.1) e com o `refresh_token` em memória (§4.2) |
| **Observador de rede** | nada em claro | TLS (Transport Layer Security) até a Vercel e até a borda do IdP; contexto seguro obrigatório | — |
| **Site malicioso** | pode tentar iniciar login, forçar callback ou emoldurar a SPA | `state`, `nonce`, PKCE; destino só da própria origem | clickjacking sem `frame-ancestors` (§4.1); emoldurada, a SPA pode ser induzida a "Aceitar" os termos, "Reenviar" ou salvar o perfil; impacto baixo a médio |
| **Quem intercepta o `code`** | um `code` de 60 s | PKCE: sem o `code_verifier` a troca falha; `no-referrer` | — |
| **RP ou IdP impostor** | pode oferecer `id_token` alheio | `iss` exato, `aud` = `client_id`, assinatura contra o JWKS do issuer configurado | — |
| **Borda da Cloudflare** | lê tokens, `code` e senhas em claro, e pode servir conteúdo no domínio do IdP | nada do lado da SPA | risco aceito no IdP (ADR 0027 do IdP) |
| **Quem usa o mesmo dispositivo depois** | a sessão de SSO do IdP, se ninguém saiu | o reload zera a memória; "Sair" encerra a sessão no IdP | fechar a aba sem "Sair" deixa o cookie de SSO vivo no IdP |
| **Deploy de preview** | nada | sem variáveis e sem `Application`: o boot falha | — |

---

## §4. Lacunas mapeadas

Nenhuma está implementada; cada uma traz impacto e mitigação possível.

### §4.1 Cabeçalhos de segurança ausentes

O `vercel.json` declara só `Referrer-Policy` e `X-Content-Type-Options`. Faltam:

- **CSP (Content Security Policy).** É a principal defesa que falta contra XSS, e um XSS lê os
  tokens em memória. Mitigação: `script-src 'self'` e `connect-src` limitado à origem do IdP,
  que muda por ambiente.
- **`frame-ancestors` / `X-Frame-Options`.** A SPA pode ser emoldurada. Mitigação:
  `frame-ancestors 'none'` na CSP.
- **HSTS (HTTP Strict Transport Security).** Não está declarado no projeto; o que vale é o padrão
  da Vercel. Mitigação: declarar e conferir na resposta de produção.

### §4.2 `refresh_token` em memória sem uso

O IdP emite um `refresh_token` que não expira, e a biblioteca o guarda junto com os demais
tokens, embora a SPA nunca o use (ADR 0014). Um XSS o leva, e com ele a sessão sobrevive às 10 h
do `access_token` até alguém revogá-lo no IdP. Mitigação: descartar o `refresh_token` ao receber,
ou pedir ao IdP que não o emita para esta `Application`, o que muda os dois lados.

### §4.3 Tokens roubados valem 10 h

`access_token` e `id_token` valem 10 h, e a SPA só consegue revogá-los pelo "Sair". Um token
levado antes disso vale até expirar. A troca de senha, a redefinição e a exclusão no IdP também
os revogam. Mitigação: validade menor, o que é decisão do IdP e contrato (`contrato-idp.md` §10).

### §4.4 `sessionStorage` durante o redirect

`state`, `nonce` e `code_verifier` ficam no `sessionStorage` entre a ida ao IdP e a volta, porque
a memória não sobrevive à navegação. Um XSS nesse intervalo os lê. O impacto é pequeno: sem o
`code`, que vai direto ao `/callback`, eles não bastam.

### §4.5 Cadeia de dependências

O CI roda typecheck, lint e testes, mas não `npm audit` nem Dependabot, e os e2e não rodam no CI.
Uma dependência comprometida é o caminho mais provável para um XSS. Mitigação: auditoria no CI
e atualização automática de dependências.

### §4.6 `email_verified` só informa

O IdP emite `email_verified` (ADR 0031 do IdP), e a API de conta o devolve. A SPA o usa só para a
faixa "Confirme seu e-mail". Falso não diz que o endereço é alheio. Verdadeiro vale só para o
endereço atual, e um antivírus que abra o link o liga. Passa a ser lacuna no dia em que algo for
autorizado pelo e-mail.

### §4.7 Chave única no IdP

O JWKS tem uma chave, sem conjunto de rotação (ADR 0004 do IdP). A SPA recarrega o JWKS quando
aparece um `kid` desconhecido, mas uma troca de chave invalida a verificação dos tokens emitidos
antes dela. Resolver depende do IdP, com ADR nos dois lados.

---

## §5. Fora do escopo da SPA

Custódia da chave privada, acesso ao admin, trilha de auditoria, revogação por desativação de
conta e o risco da máquina que hospeda o IdP ficam em `docs/seguranca.md` do IdP.
