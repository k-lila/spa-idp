# Apontamentos ao IdP

| Campo | Valor |
| --- | --- |
| Natureza | documento de trabalho da aplicação de página única (SPA, de _Single-Page Application_), relying party (RP) do provedor de identidade (IdP, de _Identity Provider_): lista do que a implementação das telas de conta precisa do IdP. Nenhuma ADR (Architecture Decision Record) o cita. É retirado quando os itens forem levados ao IdP e resolvidos |
| Data | 2026-10-06 |
| Regra | a SPA segue a implementação sem ler nem esperar o IdP; o que dependeria dele vira item aqui |

Cada item traz **Onde** (arquivo e linha do IdP, ou "operação"), **O que** (o que muda ou o que
se pede), **Por quê**, **Efeito na SPA**, **Bloqueia** (nada, fatia F5, implantação ou o marco
indicado) e **Estado**. As fatias são as do relatório `docs/pre-implementacao-telas-de-conta.md`
§4; a F5 é a integração contra o IdP real.

## Itens

### A-01 · Cabeçalhos de erro que a SPA não lê

- **Onde:** `docs/integracao-rp.md` do IdP, l.250–252.
- **O que:** hoje diz que é por `WWW-Authenticate` e `Retry-After` "que a SPA distingue token
  vencido de scope faltando e sabe quanto esperar". Proposta: "…expostos ao `fetch`, úteis a
  qualquer RP; a SPA hoje não lê nenhum dos dois".
- **Por quê:** a ADR 0020 da SPA (item D-1) não trata o `403` de scope à parte e não lê esses
  cabeçalhos.
- **Efeito na SPA:** nenhum.
- **Bloqueia:** nada.
- **Estado:** resolvido no IdP (árvore de trabalho, sem commit).

### A-02 · Contraparte da ADR 0031 citada pelo número

- **Onde:** ADR 0031 do IdP, l.14 e l.161; `docs/arquitetura.md` do IdP (índice e pares).
- **O que:** hoje citam a contraparte como ADR "telas de conta" da SPA, "devida lá". Proposta:
  citar "ADR 0020 da SPA" pelo número, já que ela existe ("Proposto", 2026-10-06), e registrar
  o par 0031 ↔ 0020 no índice.
- **Por quê:** os pares propostos juntos têm reciprocidade.
- **Efeito na SPA:** nenhum.
- **Bloqueia:** o aceite conjunto (A-03).
- **Estado:** resolvido no IdP (árvore de trabalho, sem commit).

### A-03 · Aceite conjunto das ADRs 0031 e 0020

- **Onde:** operação.
- **O que:** as ADRs 0031 do IdP e 0020 da SPA passam a "Aceito" no mesmo ato. Nesse ato a ADR
  0012 da SPA recebe "Substituído por ADR-0020". O `CLAUDE.md` do observatório ganha o par telas
  de conta (IdP 0031 ↔ SPA 0020); este sub-ponto é do observatório, não do IdP.
- **Por quê:** par proposto junto só fecha quando os dois lados mudam de status no mesmo ato.
- **Efeito na SPA:** a 0020 passa a "Aceito" e a 0012 a "Substituído por ADR-0020".
- **Bloqueia:** implantação.
- **Estado:** aberto — operação da pessoa usuária.

### A-04 · Reconferência da árvore de trabalho do IdP

- **Onde:** operação, sobre a árvore de trabalho do IdP (sem commit).
- **O que:** a SPA implementa contra o que leu em 2026-10-01 e 2026-10-06
  (`docs/pre-implementacao-telas-de-conta.md` §3). Pede-se ao IdP confirmar, ou apontar a
  diferença, em:
  - `accounts/api.py`: corpo do GET e do PATCH com `sub`, `email`, `email_verified`,
    `first_name`, `last_name`, `nickname`, `date_joined`, `updated_at` (ISO),
    `senha_alterada_em` (ISO ou `null`), `termos_versao`, `termos_versao_vigente`; lista
    fechada do PATCH, com `max_length` 150; `codigo` de `403` no corpo,
    `aplicacao_nao_autorizada` e `conta_inativa`, e `insufficient_scope` só no
    `WWW-Authenticate`; `termos_desatualizados` sem `strip`; destinos de `confirmar`.
  - `accounts/paginas.py`: voltas à SPA em `/app/conta?aviso=senha-trocada`,
    `/app/conta?aviso=email-trocado`, `/?conta=desativada`, `/?conta=apagada`,
    `/?email=confirmado` e `/?email=invalido`.
  - `config/urls.py`: `/api/conta/`, `/api/conta/confirmacao/`, `/api/conta/termos/`,
    `/accounts/password_reset/`, `/accounts/password_change/`, `/accounts/email/` e
    `/accounts/excluir/`, todos com barra final.
  - `config/settings.py`: `CORS_URLS_REGEX = r"^/(?:o|api/conta)/"`, `CORS_EXPOSE_HEADERS`,
    `TERMOS_VERSAO_VIGENTE = "1"`, limite de 120/min por caminho,
    `OIDC_RP_INITIATED_REGISTRATION_*` e o scope `conta` em `OAUTH2_PROVIDER`.
- **Por quê:** o que o IdP tem sem commit pode mudar até a implantação.
- **Efeito na SPA:** qualquer diferença volta ao contrato e ao código antes da F5.
- **Bloqueia:** fatia F5.
- **Estado:** respondido; SPA alinhada em 2026-10-06.

### A-05 · IdP local pronto para a integração

- **Onde:** operação.
- **O que:** o IdP rodando localmente com a árvore de trabalho; `SPA_CLIENT_ID` certo no `.env`
  dele; a Application de desenvolvimento com `skip_authorization`; a descoberta publicando o
  scope `conta`, a claim `email_verified` e `create` em `prompt_values_supported`.
- **Por quê:** a integração só vale contra o IdP real, não contra o fake.
- **Efeito na SPA:** nenhum no código; sem isso a F5 não roda.
- **Bloqueia:** fatia F5.
- **Estado:** aberto — operação da pessoa usuária.

### A-06 · Ordem de implantação

- **Onde:** operação.
- **O que:** o IdP vai a produção primeiro. A SPA só faz push na `main`, que publica na Vercel,
  depois disso e do aceite conjunto (A-03).
- **Por quê:** a SPA nova pede o scope `conta`; contra um IdP sem ele recebe `invalid_scope` e
  ninguém entra.
- **Efeito na SPA:** o push na `main` espera.
- **Bloqueia:** implantação.
- **Estado:** aberto — operação da pessoa usuária.

### A-07 · Termos aceitos sem texto publicado (informativo)

- **Onde:** `templates/registration/cadastro.html` do IdP, l.19 e l.64–66;
  `accounts/paginas.py` do IdP, l.122–129.
- **O que:** nada se pede. O cadastro grava `termos_versao` vigente com links para
  `{SPA_URL}/termos` e `{SPA_URL}/privacidade`. Entre a implantação do IdP e a da SPA nova,
  essas rotas dão 404 na SPA de produção, e o aceite fica registrado sem texto publicado.
- **Por quê:** risco aceito pela pessoa usuária em 2026-10-06; registra-se para que o IdP saiba.
- **Efeito na SPA:** nenhum.
- **Bloqueia:** nada.
- **Estado:** registrado no IdP.

### A-08 · Texto da versão 1 dos termos e da política de privacidade

- **Onde:** operação; `TERMOS_VERSAO_VIGENTE` em `config/settings.py` do IdP.
- **O que:** o texto final da versão 1 dos termos de uso e da política de privacidade, que é da
  pessoa dona do sistema. Até lá, a SPA guardará marcadores em `src/termos.ts` (criado na
  fatia F2).
- **Por quê:** a versão que a SPA exibe (`TERMOS_VERSAO = "1"`) precisa casar com
  `TERMOS_VERSAO_VIGENTE` do IdP; o aceite registra o texto mostrado.
- **Efeito na SPA:** troca dos marcadores pelo texto final em `src/termos.ts`.
- **Bloqueia:** implantação.
- **Estado:** aberto — operação da pessoa usuária.

### A-09 · Detalhes da API de conta que o fake da SPA aproximou

- **Onde:** `accounts/api.py` do IdP; para o ponto 6, a configuração do `prompt` em
  `config/settings.py` do IdP.
- **O que:** levantados na fatia F1. Pede-se ao IdP confirmar, ou dizer o valor real:
  1. o texto exato das `mensagem` em inglês dos erros `invalid`, `termos_desatualizados` e
     `json_invalido` (o de `max_length` segue o padrão do Django);
  2. se o `401` por token ausente traz `error="invalid_token"` ou o desafio sem `error`
     (RFC 6750 §3.1);
  3. os parâmetros exatos do desafio `403` com `insufficient_scope` (o fake manda
     `scope="conta"`; o contrato da SPA cita `resource_metadata`);
  4. qual `403` sai quando se aplicam ao mesmo tempo `insufficient_scope` e
     `aplicacao_nao_autorizada` (o fake checa nessa ordem: `401`, `insufficient_scope`,
     `aplicacao_nao_autorizada`);
  5. se um `PATCH` com JSON que não é objeto (lista, número) vira `json_invalido` em `geral`, e
     se um `PATCH` sem nenhum campo da lista muda `updated_at`;
  6. se `prompt=create` combinado com outro valor (por exemplo `login create`) é aceito.
- **Por quê:** a SPA segue sem ler o IdP; o fake dos testes de ponta a ponta espelha o
  contrato, e onde o contrato não fixa o detalhe ele escolheu um valor plausível.
- **Efeito na SPA:** a SPA só usa a `mensagem` como reserva e não lê os cabeçalhos do desafio,
  então nada muda no código da SPA; diferenças ajustam o fake (`dev/idp-fake/server.js`) e, se
  for o caso, `docs/contrato-idp.md` §11.
- **Bloqueia:** nada (conferido na F5).
- **Estado:** respondido; SPA alinhada em 2026-10-06: o fake (`dev/idp-fake/server.js`) passou a
  mandar o desafio do `403` com `error_description` e sem `scope`, o `401` sem `error` quando falta
  `Authorization`, as `mensagem` do IdP, `required` em `versao` e o `PATCH` vazio sem gravar; o
  contrato §11 registra o que o IdP confirmou.

### A-10 · Token revogado ou vencido na API de conta responde 401

- **Onde:** `accounts/api.py` do IdP (autenticação da API).
- **O que:** confirmar que a API de conta responde `401`, com `WWW-Authenticate: Bearer`, a
  token vencido, revogado ou desconhecido, e não `403`, como faz por padrão a autenticação do
  Django REST framework sem `authenticate_header`; e que a verificação de integração da F5
  inclua um token revogado (trocar a senha ou sair em outra aba e voltar à aba aberta).
- **Por quê:** a SPA só refaz o login no `401` (ADRs 0008 e 0020). Pela D-1, o `403` vira erro
  genérico, e a guarda fecha `/app` sem saída além de "Sair" e "tentar de novo".
- **Efeito na SPA:** nenhum no código se for `401`; se for `403`, é decisão a reabrir nos dois
  lados.
- **Bloqueia:** F5.
- **Estado:** respondido; SPA alinhada em 2026-10-06.

### A-11 · Formato das datas e do corpo dos `403` da API de conta

- **Onde:** `accounts/api.py` do IdP.
- **O que:** confirmar (1) a serialização exata de `date_joined`, `updated_at` e
  `senha_alterada_em` (ISO 8601 com `Z` ou `+00:00`? com microssegundos?), (2) que os `403`
  com `codigo` têm o corpo `{"codigo": "..."}` no topo, sem outro envelope, e (3) a semântica
  de `senha_alterada_em: null`: "nunca trocada" ou "sem registro" (contas anteriores ao campo).
- **Por quê:** a SPA valida as datas só como texto (nenhuma é interpretada ainda; a F3 formata
  `senha_alterada_em` em pt-BR) e lê o `codigo` do topo do corpo para `conta_inativa` (D-16).
- **Efeito na SPA:** diferença no formato pode quebrar a formatação da F3; diferença no corpo
  do `403` faz `conta_inativa` cair na mensagem genérica; se `null` for "sem registro", o texto
  de Minha conta, hoje "nunca alterada", passa a "sem registro".
- **Bloqueia:** F5.
- **Estado:** respondido; SPA alinhada em 2026-10-06: Minha conta mostra "sem registro" para
  `senha_alterada_em: null`; a formatação já interpretava as duas formas de data; o contrato
  §11.1 registra o formato e a semântica de `null`.

### A-12 · Chave do limite de 120 por minuto atrás do túnel

- **Onde:** `config/settings.py` do IdP (`RATE_LIMIT_POR_CAMINHO`) e o limitador que o aplica.
- **O que:** confirmar qual é a chave do limite: o IP real do cliente, pelo cabeçalho do
  Cloudflare, o IP do `cloudflared` ou o `Origin`. Se a chave for comum a todos, o limite vira
  global.
- **Por quê:** a guarda da SPA faz o GET da conta a cada carga de `/app` e a cada foco da aba,
  mais uma retentativa (D-15). Com chave comum, a soma de todos os usuários pode passar de 120
  por minuto e fechar `/app` para todos (D-6).
- **Efeito na SPA:** nenhum no código se a chave for por pessoa; se for global, é decisão a
  reabrir (frequência do GET da guarda).
- **Bloqueia:** implantação.
- **Estado:** respondido; SPA alinhada em 2026-10-06.

### A-13 · Troca de versão dos termos: o que conta como aceito na janela

- **Onde:** `config/settings.py` do IdP (`TERMOS_VERSAO_VIGENTE`) e o endpoint de termos
  (`POST /api/conta/termos/`).
- **O que:** decidir, nos dois lados, o que conta como aceito durante a janela em que o IdP
  aceita as duas versões (contrato da SPA, §10).
- **Por quê:** a guarda só abre `/app` com `termos_versao` igual a `termos_versao_vigente`, e a
  SPA envia a própria `TERMOS_VERSAO` (D-2, D-5). Com a janela, a troca tranca alguém em
  qualquer ordem. SPA primeiro: quem aceita a v2 fica preso enquanto a vigente é a v1, e a
  mensagem de `termos_desatualizados` fica falsa (diz que a página não tem a versão nova). IdP
  primeiro: a aba com o bundle antigo
  aceita a v1, recebe `204` e volta a `/app/termos` sem mensagem.
- **Efeito na SPA:** nada no código agora; a decisão foi adiada pela pessoa usuária para antes
  da primeira troca de versão.
- **Bloqueia:** a primeira troca de versão dos termos.
- **Estado:** aberto — decisão adiada; o IdP não tem janela no código.

### A-14 · `prompt=create` com sessão aberta no IdP

- **Onde:** o tratamento de `prompt=create` no `/o/authorize/` e `accounts/paginas.py`
  (cadastro) do IdP.
- **O que:** confirmar o que acontece quando o pedido de autorização chega com `prompt=create`
  e já há sessão aberta no IdP: a pessoa entra na conta existente (o que a nota da Landing e
  `docs/contrato-idp.md` §4 da SPA afirmam), a página de cadastro abre mesmo assim, ou o
  cadastro manda o usuário logado para outro lugar.
- **Por quê:** o fake da SPA retira `create` (D-10), então nada na SPA prova esse
  comportamento.
- **Efeito na SPA:** se não for "entra na conta existente", a nota da Landing e o contrato §4
  mudam.
- **Bloqueia:** F5.
- **Estado:** respondido; SPA alinhada em 2026-10-06.

### A-15 · Origem `https://localhost:5173` da SPA em desenvolvimento

- **Onde:** `CORS_ALLOWED_ORIGINS` e `SPA_URL` do `.env` de desenvolvimento do IdP; a
  `Application` de dev no admin do IdP.
- **O que:** a SPA de dev passou a `https://localhost:5173` (decisão da pessoa usuária,
  2026-10-06, em vez de o IdP aceitar `http` em dev). Pede-se ao IdP:
  1. incluir `https://localhost:5173` em `CORS_ALLOWED_ORIGINS` de desenvolvimento. A
     `Application` de dev passa a `https://localhost:5173/callback` em `redirect_uris` e
     `https://localhost:5173/` em `post_logout_redirect_uris`, por operação da pessoa usuária no
     admin. Conferido como feito em 2026-10-06, as duas partes.
  2. passar `SPA_URL` de desenvolvimento de `http://localhost:5173` a `https://localhost:5173`.
     Constatado na F5 (2026-10-06): o link de confirmação do e-mail redireciona a
     `http://localhost:5173/?email=confirmado`, onde nada escuta, porque a SPA de dev só serve
     https, e o navegador recebe resposta vazia. O mesmo valor monta todas as voltas do IdP à SPA
     (`/app/conta?aviso=…`, `/?conta=…`, `/?email=…`) e os links `/termos` e `/privacidade` do
     cadastro.
- **Por quê:** constatado na F5 (2026-10-06): com `OAUTH2_PROVIDER["ALLOWED_REDIRECT_URI_SCHEMES"]`
  em `["https"]` (`BEHIND_TLS_PROXY=True`, `config/settings.py` do IdP), depois do cadastro
  `/o/authorize/` levanta `DisallowedRedirect: Redirect to scheme 'http' is not permitted` ao
  devolver a `http://localhost:5173/callback`; com `https` no `redirect_uris` e a SPA ainda em
  `http`, o pedido da SPA é recusado como "Mismatching redirect URI". Nenhum login conclui.
- **Efeito na SPA:** `vite.config.ts` serve https quando `SPA_DEV_TLS_CERT` e `SPA_DEV_TLS_KEY`
  apontam para o certificado do `mkcert localhost`; `.env.example` e `docs/contrato-idp.md` §1 e
  §2 descrevem o dev em https. Os e2e seguem em `http://localhost:5173` contra o fake.
- **Bloqueia:** F5.
- **Estado:** aberto — falta `SPA_URL`.

## Premissas da SPA sobre o IdP

| Premissa | Onde a SPA depende dela |
| --- | --- |
| O IdP concede todo scope declarado que a RP pede, sem scope por Application | D-1: o `403` de scope não ganha tratamento próprio |
| A Application da SPA tem `skip_authorization` | D-1: o scope novo entra sem tela de consentimento |
| A API (interface de programação) de conta não aceita sessão, só Bearer | isenção de proteção contra falsificação de requisição entre sites (CSRF, de _Cross-Site Request Forgery_) |
| A API e as páginas vivem na origem do issuer, com o issuer em `{origem}/o` | exceção de I5: a SPA deriva a base da API e das páginas do issuer |
| `/api/conta/` com CORS (_Cross-Origin Resource Sharing_) para a origem da SPA, métodos `GET, PATCH, POST`, cabeçalhos `authorization` e `content-type` | toda chamada da SPA à API de conta |
| O IdP conhece as rotas da SPA `/`, `/app/conta`, `/termos` e `/privacidade` | voltas das páginas do IdP e links do cadastro |
| O IdP de desenvolvimento responde em `https://localhost/o`, pelo proxy, com certificado de uma CA local (`ca-local.crt` do IdP) em que o navegador precisa confiar | `VITE_OIDC_ISSUER` de dev; descoberta e JWKS falham por TLS sem a CA |

## Resposta do IdP

Respondida em 2026-10-06, contra o código da árvore de trabalho do IdP, ainda sem commit, e o
`django-oauth-toolkit` 3.4.1 instalado nele. Vale até a implantação; o que mudar lá volta aqui.
O campo **Estado** de cada item acima não foi alterado: fechar cada um é decisão da SPA.

### O que pede mudança na SPA

- **A-11.3 · `senha_alterada_em: null` quer dizer "sem registro".** A conta nova é carimbada já
  na criação (`accounts/models.py` do IdP, l.138). O `null` só aparece em conta anterior ao
  campo, nunca em conta que "nunca trocou a senha". O texto de Minha conta, hoje "nunca
  alterada", passa a "sem registro".
- **A-11.1 · Datas em `isoformat()`, em UTC (_Coordinated Universal Time_).** O sufixo é
  `+00:00`, nunca `Z`. Os microssegundos aparecem, mas somem quando valem zero
  (`2026-10-06T12:00:00+00:00`), e o tamanho do texto varia. A formatação da F3 deve interpretar
  a data, não depender de um tamanho fixo.
- **A-09.3 · O desafio do `403` não traz `scope`.** O cabeçalho é
  `Bearer error="insufficient_scope",error_description="The access token is valid but does not have enough scope.",resource_metadata="…"`.
  O fake manda `scope="conta"` e deve deixar de mandar. O código da SPA não muda, porque não lê
  o cabeçalho.

### O que já foi resolvido no IdP

- **A-01.** `docs/integracao-rp.md` do IdP, §5.4, agora diz que `WWW-Authenticate` e
  `Retry-After` servem a qualquer RP e que a SPA deste sistema não lê nenhum dos dois.
- **A-02.** A ADR 0031 do IdP cita "ADR 0020 da SPA" nos dois lugares. `docs/arquitetura.md` do
  IdP registra o par 0031 ↔ 0020 no índice, na tabela de pares e no texto que a acompanha.

As duas edições estão na árvore de trabalho do IdP, sem commit.

### O que o IdP confirma

- **A-04.** Tudo o que a SPA leu bate com o código:
  - o corpo do GET e do PATCH;
  - a lista fechada com `max_length` 150;
  - os `403` com `codigo` (`aplicacao_nao_autorizada`, `conta_inativa`);
  - `insufficient_scope` só no cabeçalho;
  - `termos_desatualizados` sem `strip`;
  - as voltas à SPA;
  - as rotas com barra final;
  - `CORS_URLS_REGEX`, `CORS_EXPOSE_HEADERS` e `TERMOS_VERSAO_VIGENTE = "1"`;
  - o teto de 120 por minuto;
  - o cadastro por `prompt=create` e o scope `conta`.

  O IdP tem ainda `/api/conta/confirmar/`, o link do e-mail de confirmação, que a SPA não chama.
- **A-09.** Os detalhes que o fake aproximou:
  1. As `mensagem`: `invalid` é `"Enter a string."` (valor do JSON que não é texto);
     `termos_desatualizados` é `"This is not the current version of the terms."`;
     `json_invalido` é `"The request body must be a JSON object."`. Sem `versao`, o erro é
     `required`, com `"This field is required."`.
  2. Sem cabeçalho `Authorization`, o `401` traz o desafio sem `error`:
     `Bearer resource_metadata="…"`. Com token inválido, traz `error="invalid_token"`.
  3. Ver A-09.3, acima.
  4. A ordem é `401`, `insufficient_scope`, `aplicacao_nao_autorizada`, `conta_inativa`, a mesma
     do fake.
  5. Corpo que é lista ou número vira `json_invalido` em `geral`. Um `PATCH` sem nenhum campo da
     lista não grava nada, e `updated_at` não muda.
  6. `create` combinado com outro valor é aceito: o toolkit trata o `create` primeiro e o tira
     do `prompt`, mantendo os demais.
- **A-10.** Token vencido, revogado ou desconhecido recebe `401` com
  `WWW-Authenticate: Bearer error="invalid_token"`. A API não usa o Django REST Framework, e só
  `insufficient_scope` dá `403`. A verificação da F5 com token revogado continua valendo.
- **A-11.2.** Os `403` com `codigo` têm o corpo `{"codigo": "..."}` no topo, sem envelope.
- **A-12.** A chave do limite é o caminho e o IP do cliente. O proxy do IdP só confia no
  conector do túnel, lê `CF-Connecting-IP` e repassa um único endereço; o limite é por pessoa,
  não global. Duas ressalvas: pessoas atrás do mesmo NAT (_Network Address Translation_) dividem
  a chave; e, se a confiança no conector falhar, o limite vira global sem aviso (ADR 0027 do
  IdP, "Colapso silencioso").
- **A-14.** Com sessão aberta no IdP, `prompt=create` não faz nada: o pedido segue como
  autorização comum e, com `skip_authorization`, a pessoa entra na conta existente. A página de
  cadastro aberta direto com sessão também redireciona ao `next`. A nota da Landing e
  `docs/contrato-idp.md` §4 da SPA estão certas.
- **Premissas.** Todas batem com o código:
  - o toolkit não tem scope por Application, e o que restringe a API à SPA é a comparação com
    `SPA_CLIENT_ID`;
  - a API só aceita Bearer;
  - o CORS vale sob `/api/conta/`;
  - as rotas da SPA citadas são as que o IdP usa.

  O `skip_authorization` é configuração do admin e não se confere pelo código.

### O que o IdP registra sem resolver

- **A-13.** No código do IdP não há janela. `_Termos.clean_versao` aceita só a versão igual a
  `TERMOS_VERSAO_VIGENTE`. A janela existe só no texto (ADR 0031 do IdP, consequências;
  `docs/integracao-rp.md` do IdP, termos). Abri-la exige código novo no IdP, decidido junto com
  o critério de "aceito".
- **A-07.** Registrado no IdP; nada a fazer.

### O que é operação, da pessoa usuária

- **A-03.** Aceite conjunto das ADRs 0031 e 0020.
- **A-05.** IdP local de pé. O `SPA_CLIENT_ID` do `.env` e o `skip_authorization` não se conferem
  pelo código. A descoberta publica o scope `conta`, a claim `email_verified` e `create` em
  `prompt_values_supported`.
- **A-06.** O IdP vai a produção primeiro.
- **A-08.** O texto da versão 1 dos termos e da política de privacidade.
