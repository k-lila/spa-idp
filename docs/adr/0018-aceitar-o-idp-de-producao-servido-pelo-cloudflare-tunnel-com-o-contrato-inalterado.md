# 0018. Aceitar o IdP de produção servido pelo Cloudflare Tunnel com o contrato inalterado

## Status

Proposto — 2026-09-24

Contraparte da ADR (Architecture Decision Record) 0027 do provedor de identidade (IdP, de
_Identity Provider_), também proposta.
As duas passam a Aceito juntas, depois do ensaio descrito no passo 4 de
`docs/plano-implantacao.md` do IdP. Esta ADR não emenda nenhuma outra: a ADR 0017 fixou a forma
do issuer, e não o lugar em que o IdP roda, e a menção à AWS (Amazon Web Services) nas ADRs 0015,
0016 e 0017 fica como registro do destino da época.

## Contexto

Esta aplicação de página única (SPA, de _Single-Page Application_) é a relying party (RP) do IdP.
As ADRs 0016 e 0017 e `docs/contrato-frontend.md` supõem o IdP de produção numa
instância da AWS. A ADR 0027 do IdP troca esse destino pela máquina do dono do projeto, publicada
por um túnel nomeado da Cloudflare sob o domínio próprio que a ADR 0025 do IdP exige, numa zona
da Cloudflare só do IdP. A cadeia passa a ser navegador → borda da Cloudflare → túnel →
`cloudflared` → Caddy → Django, e o TLS (Transport Layer Security) do navegador termina na borda.

O que a SPA consome do IdP não depende de onde ele roda:

- `VITE_OIDC_ISSUER` é o `authority` do `UserManager` (`src/auth/userManager.ts`) e o `issuer` de
  `verifyIdToken` (`src/auth/idToken.ts`), comparado byte a byte com a claim `iss` (ADRs 0013 e
  0017). A forma `https://<PUBLIC_HOST>/o` está congelada pela ADR 0025 do IdP,
  e a 0027 a mantém: `PUBLIC_HOST` é o nome do domínio próprio publicado pela borda.
- Os endpoints vêm da descoberta (I5). O JWKS (JSON Web Key Set) vem do `jwks_uri`, buscado a cada
  login. O reload de `createRemoteJWKSet` por `kid` desconhecido é inerte aqui (ADR 0013): depois
  de uma troca de chave no IdP, o login falha por até 1–2 h, enquanto o navegador guarda o JWKS
  antigo.
- A origem da SPA e a `redirect_uri` entram no CORS (Cross-Origin Resource Sharing) e na
  `Application` do IdP por igualdade exata (ADR 0016). A 0027 configura a zona do IdP para que nada
  na borda desafie, reescreva ou injete conteúdo sob o domínio do IdP.
- `requestTimeoutInSeconds` de 15 s limita a espera pela descoberta e por `/o/token/` (ADR 0015).

A topologia traz três fatos novos para a SPA:

- **A borda termina o TLS.** Ela lê em texto claro o `code`, o `access_token`, o `id_token`, o
  `refresh_token`, a senha digitada na tela de login do IdP e o cookie de sessão do IdP. Com o
  cookie do superusuário, quem o captura entra no `/admin/` do IdP e cria uma `Application` com
  `redirect_uri` própria e `skip_authorization=True`, que persiste depois de a captura cessar. A
  borda pode também servir qualquer conteúdo sob o domínio, inclusive a descoberta e o JWKS. A
  verificação de I4 (assinatura pelo `jwks_uri`, `iss` exato) se ancora no certificado do domínio
  do IdP. Com a borda dentro dessa âncora, a SPA não distingue a borda do IdP.
- **A chave de assinatura fica na máquina do dono.** A `OIDC_RSA_PRIVATE_KEY` de produção vive no
  `.env` de um clone na mesma máquina e com o mesmo usuário que rodam desenvolvimento,
  `npm install` e agentes com shell (ADR 0027, negativa *Mesmo privilégio*). Quem a lê emite
  `id_token` que esta SPA aceita para qualquer `sub`. A resposta a um vazamento é trocar a chave,
  e a troca derruba o login da SPA por até 1–2 h (ADR 0013).
- **O IdP depende da máquina do dono.** O compose de produção reinicia os serviços depois de um
  reboot ou da queda de um processo (ADR 0027, *Reinício*). Com a máquina desligada, suspensa ou
  sem rede, o IdP fica fora.

## Decisão

Vamos aceitar o IdP de produção servido pelo Cloudflare Tunnel sem mudar código nem contrato da
SPA.

- **Nenhuma mudança de código.** `src/config.ts`, `src/auth/userManager.ts`, `src/auth/idToken.ts`
  e `vercel.json` ficam como estão. Os valores de produção são os que a ADR 0016 já previa,
  `VITE_OIDC_ISSUER` e `VITE_OIDC_CLIENT_ID` no ambiente Production do painel da Vercel, e nenhum
  entra no repositório (I6).
- **Conferência byte a byte.** Antes de gravar `VITE_OIDC_ISSUER` no painel, o valor é comparado
  com o `issuer` que `https://<PUBLIC_HOST>/o/.well-known/openid-configuration` publica. A
  consulta é feita de fora da máquina do dono, pela borda (regra 4 da ADR 0025 do IdP; passo 6 do
  plano do IdP). O host é o nome do domínio próprio, e nunca um nome de `trycloudflare.com` nem o
  destino `cfargotunnel.com` do registro de DNS (Domain Name System) do túnel.
- **Riscos aceitos.** A SPA aceita, como o dono aceitou na ADR 0027, que a borda veja os tokens e
  o cookie de sessão do IdP e possa servir descoberta e JWKS sob o domínio dele, e que a chave de
  assinatura fique na máquina do dono. O gatilho de revisão dos dois riscos é o mesmo na 0027:
  pessoa usuária real além do dono, ou segunda RP.
- **Migração sem redeploy.** A 0027 leva o IdP a uma VM (máquina virtual) movendo o clone, as
  credenciais do túnel e os volumes, com um conector só e sem mudar DNS nem issuer. Enquanto
  `PUBLIC_HOST` for o mesmo, a SPA não recebe valor novo nem é republicada.
- **Troca de chave sem redeploy, mas não sem falha.** Uma troca de chave muda o `kid` e não exige
  valor novo nem redeploy. Mas a SPA não a absorve na hora: pela ADR 0013, o login falha por até
  1–2 h depois dela. Isso vale em qualquer topologia, e esta ADR não o muda; as saídas são as que a
  0013 nomeia, em tarefa própria. Trocar o nome, e não o lugar, continua exigindo ADR nova nos dois
  lados, valor novo no painel e redeploy (ADR 0017).

Contraparte: a ADR 0027 do IdP e, por ela, a ADR 0025 do IdP. Nenhuma linha de código muda
nos dois lados.

## Consequências

Positivas:

- Zero código e zero valor novo: o que as ADRs 0016 e 0017 prepararam serve como está.
- A conferência do issuer continua sendo uma comparação entre duas strings, a mesma da ADR 0017.
- A migração para uma VM e a rotação do túnel depois de um vazamento de credenciais (ADR 0027)
  não chegam à SPA: o nome não muda.
- Depois de um reboot da máquina do dono, o IdP volta sem ação de ninguém, e a SPA volta a logar
  sem redeploy.

Negativas:

- **Um terceiro vê tudo.** A Cloudflare lê o `code`, os tokens e o cookie de sessão do IdP a
  caminho da SPA. A verificação do `id_token` (ADR 0013) não protege contra ela, porque quem
  controla a borda serve descoberta e JWKS que a SPA aceita. Aceito, sob o gatilho de revisão da
  ADR 0027.
- **Chave na máquina do dono.** Um processo comprometido nessa máquina emite `id_token` válido
  para qualquer `sub`, e a SPA exibe essa identidade como afirmada pelo IdP. Aceito, sob o gatilho
  de revisão da ADR 0027.
- **Vazamento da chave derruba o login.** A troca da chave, resposta da ADR 0027 a um vazamento,
  deixa a SPA sem login por até 1–2 h, com a mensagem genérica e `JWKSNoMatchingKey` no console
  (ADR 0013).
- **Disponibilidade da máquina.** Com a máquina desligada, suspensa ou sem rede, a borda responde
  com erro e sem cabeçalho de CORS. O "Entrar" falha na descoberta com a mensagem genérica em até
  15 s (ADR 0015), sem distinguir IdP fora do ar de erro de rede. Um reload em `/app` volta a
  `/o/authorize/` (ADR 0014) e deixa a pessoa na página de erro da borda, fora da SPA.
- **Desafio da borda vira falha de CORS.** Se a zona passar a desafiar requisições em
  `/o/token/` ou `/o/userinfo/`, a resposta sai da borda sem cabeçalho de CORS, e a SPA vê erro
  de rede, e não 401. O sinal é o callback falhar enquanto a navegação até `/o/authorize/`
  funciona. A configuração da zona vive fora dos dois repositórios, e nada a verifica.
- `docs/contrato-frontend.md`, `docs/implementacao-contrato.md`, `docs/spa-nucleo.md` e o
  `CLAUDE.md` citam a AWS até a revisão do passo 5 do plano do IdP. As ADRs 0015, 0016 e 0017,
  aceitas, continuam citando.

## Alternativas consideradas

- **Condicionar a integração à ADR 0026 do IdP (AWS)** — nenhum terceiro no caminho do TLS.
  Descartada: o IdP trocou a AWS pela máquina local por custo, e a recusa deixaria a SPA sem IdP
  de produção.
- **Fixar o JWKS ou a chave pública no build** — neutralizaria uma borda que servisse JWKS falso.
  Descartada: fere I5, e cada rotação de chave passaria a exigir redeploy, o oposto da migração
  sem redeploy.
- **Ler o issuer da descoberta para tolerar troca de host** — descartada pela mesma razão da ADR
  0017: é circular, porque I4 e I6 exigem o valor esperado antes de confiar na rede.
- **Aceitar um Quick Tunnel em `trycloudflare.com` enquanto o domínio não sai** — descartada: o
  nome muda a cada subida, o que exigiria valor novo e redeploy a cada vez, e fere a regra 1 da
  ADR 0025 do IdP.
