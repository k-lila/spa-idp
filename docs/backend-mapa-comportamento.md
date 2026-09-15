# Mapa de comportamento — Back-end (IdP)

**Projeto:** estudo de arquitetura cliente-servidor
**Repositório:** `k-lila/monolito-idp` (Django · OIDC IdP, já implementado)
**Hospedagem:** Render.com ou AWS
**Modelo de confiança:** Relying Party com token (cross-origin)

---

## Premissa que define o modelo

Front na Vercel e back no Render/AWS são **origens diferentes de forma
permanente** (cross-site). Isso invalida o modelo de sessão por cookie de
primeira parte, que só valeria no mesmo origin: cookie cross-site exige
`SameSite=None` e os navegadores estão bloqueando ou particionando cookie de
terceiros. Portanto o back-end opera no modelo que a própria máquina OIDC do
repositório já implementa: **autorização por token, via redirect + PKCE**, com o
CORS liberando as chamadas cross-origin da SPA.

> **Alternativa (sessão preservada):** um proxy — rewrites da Vercel
> encaminhando `/o`, `/accounts` e `/api` para o back-end — faz o browser ver um
> origin só e ressuscita a sessão por cookie, ao custo de um salto de proxy e do
> acoplamento à borda da Vercel. As seções abaixo assumem o modelo de token.

---

## Núcleo que já existe e não muda

É o miolo de identidade e credencial. Nada disso se move para a SPA.

| Responsabilidade | Onde vive |
|---|---|
| Colher senha, validar, criar sessão do IdP | `LoginView` em `/accounts/login/` |
| Renderizar consentimento | template `oauth2_provider/authorize.html` |
| Exigir PKCE S256 na autorização | `/o/authorize/` |
| Emitir e assinar token (RS256) | `/o/token/` |
| Afirmar identidade | `/o/userinfo/` |
| Publicar chave pública e descoberta | `/o/jwks/`, `/o/.well-known/openid-configuration` |
| CRUD administrativo de usuário | Django admin (staff) |

**Claims afirmadas:** `sub`, `name` (de `get_full_name()`), `email`.
**Sem `email_verified`** — não há fluxo que sustente a afirmação nesta fase.

---

## Configuração que a hospedagem exige (config, não código)

- **`BASE_URL`** = URL pública HTTPS do Render/AWS. O issuer é `BASE_URL/o` —
  discovery, JWKS e token anunciam esse valor. Precisa ser a URL pública real.
- **`ALLOWED_HOSTS`** inclui o host do Render/AWS.
- **`CORS_ALLOWED_ORIGINS`** inclui a origem de produção da Vercel (e o domínio
  custom, se houver). `/o/token/` e `/o/userinfo/` são `fetch` cross-origin da
  SPA. Allowlist vazia deixa o middleware inerte e silencioso.
- **Cookies `Secure`** ligados (`BEHIND_TLS_PROXY`) — Render/AWS terminam TLS;
  o header de proxy (`X-Forwarded-Proto`) precisa chegar coerente.
- **Registrar a `Application`** (client público): `response_type=code`,
  `redirect_uri` = URL de callback da Vercel, **casada por igualdade exata**.

---

## Comportamento esperado (contratos)

- **Autenticação:** recebe o browser em `/o/authorize/` com `challenge`,
  `state`, `nonce`; sem sessão, serve o login; após o consentimento, redireciona
  `302` ao `redirect_uri` com `code` + `state`.
- **Emissão:** `/o/token/` troca `code` + `verifier` por
  `id_token` + `access_token` + `refresh_token`; valida o `verifier` contra o
  `challenge` (só S256).
- **Identidade:** `/o/userinfo/` responde a `Bearer` válido com
  `sub` / `name` / `email`.
- **Descoberta:** discovery e JWKS públicos, para a SPA descobrir endpoints e
  validar a assinatura.

---

## Adaptações a decidir

1. **Logout real.** RP-initiated logout está desligado
   (`OIDC_RP_INITIATED_LOGOUT_ENABLED = False`). No modelo cross-origin a SPA só
   faz logout local (esquece tokens); a sessão do IdP persiste e o login
   seguinte pode ser silencioso. Logout de verdade é uma adaptação de back-end:
   habilitar o `end_session_endpoint` e registrar o `post_logout_redirect_uri`
   da Vercel.

2. **Onde vive a gestão de conta (cadastro, editar perfil).**
   - *Padrão defensável:* continua como páginas server-side do IdP; a SPA linka
     para elas. O token da RP afirma identidade — não autoriza escrita no
     diretório de usuários (evita confusão de audiência).
   - *Variante ambiciosa:* uma API de conta de primeira parte, autorizada por um
     token com **audiência no próprio IdP** e escopo de escrita próprio (não o
     `access_token` da RP). Mais máquina, mais formas de errar audiência/escopo.

3. **Desativar precisa revogar token.** `is_active = False` não invalida token
   já emitido; a ação de desativar (admin) tem de apagar os tokens da pessoa,
   senão o refresh segue trocável.

4. **E-mail sem verificação.** Sem `email_verified`, cadastro e troca de e-mail
   afirmam um endereço não verificado na claim `email`. Aceitar no escopo de
   estudo, ou adicionar um passo de verificação.

5. **Cadastro público exige rate limit** — primeiro item listado no README antes
   de qualquer exposição.

6. **Previews da Vercel.** Cada preview deployment tem URL única, que não casa
   com o `redirect_uri` registrado (igualdade exata) nem com o CORS. A auth só
   funciona onde a URL está registrada — usar um alias estável ou registrar o
   domínio de produção.
