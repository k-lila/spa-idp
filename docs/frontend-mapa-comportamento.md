# Mapa de comportamento — Front-end (SPA)

**Projeto:** estudo de arquitetura cliente-servidor
**Papel:** Relying Party OIDC do IdP `k-lila/monolito-idp`
**Hospedagem:** Vercel
**Modelo de confiança:** autorização por token (cross-origin)

---

## Papel da SPA

A SPA é uma **Relying Party OIDC pura**. Ela não é dona da identidade, não colhe
senha e não escreve no diretório de usuários. Ela autentica por redirect, recebe
tokens, lê a identidade afirmada pelo IdP e compõe a UX em cima disso.

---

## Fluxo de autenticação (o diagrama, do lado da SPA)

1. **Início.** Gera o par PKCE (`verifier` + `challenge` S256), `state` e
   `nonce`; redireciona o browser a `/o/authorize/` no IdP.
2. **Callback** (a `redirect_uri` registrada). Recebe `code` + `state`, confere
   o `state`, faz `POST /o/token/` (cross-origin, CORS) com `code` + `verifier`,
   recebe `id_token` + `access_token` + `refresh_token`.
3. **Validação do `id_token`.** Assinatura via JWKS (RS256), `iss` = `BASE_URL/o`,
   `aud` = `client_id`, `exp`, `nonce`.
4. **Identidade.** Lê `sub` / `name` / `email` do `id_token` (ou de
   `/o/userinfo/`) e renderiza.

---

## Guarda de token e sessão

- **Tokens em memória, não em `localStorage`** — `localStorage` é lido por
  qualquer XSS.
- **Refresh de longa vida é risco.** No repositório o refresh **não expira** e
  **não rotaciona**; guardar um refresh assim no browser é exposição. Decidir o
  modelo de sessão: re-autenticar no refresh da página (silencioso se a sessão
  do IdP ainda viver) ou assumir o risco conscientemente.
- **Descobrir endpoints por discovery** (`/o/.well-known/openid-configuration`),
  não hardcode. O issuer é `/o`, não a raiz.

---

## Guarda de rota

- Rota protegida sem token válido → dispara o redirect de `/o/authorize/`.
- **Não há tela de senha na SPA.** Login e consentimento acontecem no IdP, em
  outro origin. A SPA entrega e retoma; nunca coleta credencial.

---

## Superfícies que a SPA possui

- **Perfil** — exibe `sub` / `name` / `email` a partir das claims.
- **Logout** — local: esquece os tokens (ver limitação abaixo).
- **Cadastro e edição de perfil** — linka para as páginas server-side do IdP
  (padrão), a menos que a variante de API de conta seja adotada no back-end.

---

## Limitações herdadas do modelo cross-origin

- **Logout é só local.** A SPA não encerra a sessão do IdP (o cookie vive em
  outro origin); o login seguinte pode ser silencioso. Logout real depende de
  habilitar o `end_session_endpoint` no back-end.
- **CORS e `redirect_uri` são acoplamentos de deploy.** A origem de produção da
  Vercel precisa estar no CORS do IdP, e a URL de callback registrada por
  igualdade exata. Previews com URL única não autenticam sem registro.

---

## Config que a SPA precisa

- URL do issuer/discovery do IdP (Render/AWS).
- `client_id` da `Application` registrada.
- A própria URL de callback (a `redirect_uri`).
