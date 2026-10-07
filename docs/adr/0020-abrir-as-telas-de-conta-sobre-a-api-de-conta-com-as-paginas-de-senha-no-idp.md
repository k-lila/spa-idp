# 0020. Abrir as telas de conta na SPA sobre a API de conta do IdP, com tudo o que pede senha nas páginas do IdP

## Status

Proposto — 2026-10-06

Substitui a ADR 0012. Emenda a ADR 0008 em três pontos (escrita autenticada por `PATCH` e `POST` com
JSON, `401` com volta à página atual e trava de re-autenticação por URL) e a ADR 0004 no que o fake
emite e simula (claims novas, API de conta e retirada de `create`). As duas **permanecem aceitas e
em vigor** fora do que se diz aqui.

Contraparte: ADR 0031 do IdP, proposta junto com esta. As duas passam a "Aceito" no mesmo ato, antes
da implantação, e nesse ato a 0012 recebe o status "Substituído por ADR-0020".

## Contexto

Pela ADR 0012, a SPA não oferece gestão de conta: nem própria, nem por link ao IdP, que não tinha
cadastro nem edição de perfil. A ADR 0031 do IdP abre o autoatendimento. Tudo o que recebe senha
vira página do IdP: cadastro, recuperação, troca de senha, troca de e-mail e exclusão. O resto vira
uma API JSON em caminhos fixos sob `/api/conta/`, na origem do issuer. A API exige o scope `conta`,
aceita só o Bearer da Application da SPA e não aceita sessão. O `sub` passa a UUID;
`email_verified`, `nickname` e `updated_at` entram nas claims; a descoberta anuncia `create` em
`prompt_values_supported`. A versão vigente dos termos é do IdP, mas quem exige o aceite é a SPA.

Quatro regras do núcleo da SPA (`docs/spa-nucleo.md`) colidem com isso:

- a terceira cláusula de I1 proíbe escrever no diretório de usuários com o `access_token` da RP;
- I5 manda descobrir todo endpoint, e a descoberta não publica nem a API nem as páginas de conta;
- D2 diz que não há gestão de conta;
- a lista de restrições do núcleo proíbe chamar a API de conta com o `access_token` da RP.

O wrapper da ADR 0008 só faz `GET` e chama `signin()` sem destino no `401`. A trava dele é um
marcador único, apagado por qualquer resposta que não seja `401`. Com dois recursos autenticados na
mesma página, o sucesso de um apagaria a trava do outro.

As premissas de sessão seguem as de hoje: tokens só em memória e todo reload refaz o login pelo SSO
(I3, ADR 0014); o `refresh_token` nunca é usado (ADR 0014); a Application da SPA tem
`skip_authorization` (ADR 0021 do IdP); e o IdP concede todo scope declarado que a RP pede, porque o
toolkit não limita scope por Application.

## Decisão

Vamos abrir na SPA as telas de conta para o que não pede senha: ler e editar nome, sobrenome e
apelido, aceitar os termos e reenviar a confirmação de e-mail. Elas falam com a API de conta do IdP,
com o próprio `access_token` e o scope `conta`. Para tudo o que pede senha, a SPA leva a pessoa às
páginas do IdP por navegação de página inteira. "Criar conta" é o pedido de autorização com
`prompt=create`. A tela de aceite oferece a saída para a página de exclusão do IdP, para que recusar
os termos não impeça excluir a conta.

**Núcleo.**

- I1: as duas primeiras cláusulas continuam valendo. A SPA não é dona da identidade e não coleta
  senha. A terceira passa a ser: a SPA **NÃO DEVE** escrever no diretório de usuários com o
  `access_token` da RP, **exceto** na conta da própria pessoa autenticada, pela API de conta do IdP,
  com o scope `conta`.
- I5 ganha uma exceção. Os caminhos fixos da API e das páginas de conta, que a descoberta não
  publica, são montados sobre a origem do issuer, num ponto só, `src/config.ts`, sem variável nova
  (ADR 0005). Nenhum endpoint OIDC entra na exceção.
- I8 continua valendo inteiro: nenhum campo de senha na SPA, guarda de rota por redirect.
- D2 passa a ser: gestão de conta pelas telas da SPA, sobre a API de conta, e pelas páginas do IdP,
  para tudo o que pede senha.
- Sai a restrição de não chamar a API de conta com o `access_token` da RP.

**Emenda à ADR 0008.**

- `src/api/http.ts` ganha a escrita autenticada: `PATCH` e `POST` com corpo JSON, o mesmo Bearer e a
  mesma regra de `401`. A escrita só alcança os caminhos da API de conta, e escrever em outro
  recurso com o token da RP continua exigindo alterar o wrapper. Token e `User` continuam presos ao
  módulo.
- O `401` refaz o login com volta à página atual (caminho, query e fragmento), sob a regra de
  destino da ADR 0011.
- A trava passa a ser por URL. O marcador guarda a URL que recebeu o `401`, e outro `401` na mesma
  URL lança sem novo login. Só uma resposta que não seja `401` da mesma URL o apaga.
- `403` continua sem ramo no wrapper.

**Emenda à ADR 0004.** O fake passa a emitir `email_verified`, `nickname` e `updated_at` e a
declarar o scope `conta`. Ele também simula a API de conta no mesmo processo e retira `create` do
`prompt` antes de seguir ao login. Páginas de conta, ele não serve. O princípio daquela ADR, o fake
espelhar o contrato que a SPA consome, é o que exige a mudança.

**Itens fixados.** Os itens D-1 a D-16 são desta ADR e não se confundem com as decisões D1 e D2 do
núcleo.

| # | Tema | Decisão |
| --- | --- | --- |
| D-1 | `403` com `insufficient_scope` | Sem tratamento próprio: vira o erro genérico da tela. Nenhuma aba combina o bundle novo com token sem `conta`. A aba antiga roda o bundle antigo, que não chama a API, e o novo sempre pede `conta`. Mesmo que o caso ocorresse, um novo login devolveria o mesmo token |
| D-2 | Versão no aceite | A SPA envia a versão do texto que exibe, `TERMOS_VERSAO`, constante dela. Divergência com o IdP vira `termos_desatualizados`, com mensagem |
| D-3 | Claims novas | `email_verified`, `nickname` e `updated_at` opcionais no schema de claims, e tipo inesperado é descartado, sem recusar o login; nenhuma tela as lê do `id_token` |
| D-4 | `/app` | Mantém as seções `id_token` e `userinfo` com os três campos de hoje; ganha saudação, faixa de e-mail não confirmado e link "Minha conta" |
| D-5 | Guarda de termos | Compara `termos_versao` com `termos_versao_vigente`, ambos do GET da conta. A vigência é do IdP |
| D-6 | GET da conta falha na guarda | `/app` não abre: mensagem, "tentar de novo" e "Sair" |
| D-7 | `401` no `PATCH` | O formulário se perde; o novo login volta à página atual |
| D-8 | Validação local | Só o limite de 150 caracteres nos três campos; o IdP é a autoridade |
| D-9 | Volta da exclusão | Nenhuma limpeza: os tokens vivem em memória, e o estado de redirect se limpa sozinho |
| D-10 | `prompt=create` no fake | O fake retira `create` e segue ao login, sem simular a página de cadastro |
| D-11 | Saudação | `nickname`, senão `first_name`, senão `email`, lidos do GET da conta |
| D-12 | `sub` divergente na transição para UUID | Só a mensagem atual, sem login automático; o reload resolve pelo SSO |
| D-13 | Textos dos termos | `src/termos.ts` exporta `TERMOS_VERSAO`, `TEXTO_TERMOS` e `TEXTO_PRIVACIDADE`; as páginas públicas `/termos` e `/privacidade` só exibem. Sem Markdown e sem dependência nova |
| D-14 | Trava de re-autenticação | Por URL, como na emenda à ADR 0008. Com marcador único, o sucesso do GET da conta apagaria a trava do `userinfo` a cada carga de `/app`, e o laço que a ADR 0008 cortou voltaria |
| D-15 | Retentativa do GET da conta | A padrão do cliente de consultas: uma, também para os `403` |
| D-16 | `403` com `conta_inativa` na guarda | "Esta conta está desativada.", só com "Sair" e sem "tentar de novo" |

**Premissas e gatilhos da D-1.** A D-1 vale enquanto:

- os tokens vivem só em memória e todo reload refaz o login (I3, ADR 0014);
- o IdP concede todo scope pedido, porque o toolkit não limita scope por Application;
- a Application da SPA tem `skip_authorization` (ADR 0021 do IdP);
- o `refresh_token` nunca é usado (ADR 0014).

A D-1 se revisita se o IdP passar a limitar scope por Application, ou se a SPA passar a usar o
`refresh_token` ou a persistir tokens.

**Fora do que a SPA lê.** O IdP expõe `WWW-Authenticate` e `Retry-After` ao `fetch`. A SPA não lê
nenhum dos dois.

**Implantação.** O IdP implanta primeiro, e a SPA depois. Implantada antes, a SPA pediria o scope
`conta`, receberia `invalid_scope` e ninguém entraria.

## Consequências

Positivas:

- A pessoa cria a conta, edita o perfil, aceita os termos e chega às páginas de senha sem quem
  opera, e a senha continua só no IdP.
- A nova I1 continua expressa no código: a escrita só alcança a API de conta, e o IdP a restringe ao
  `client_id` da SPA e ao scope.
- Os caminhos fixos do IdP vivem num lugar só, derivados do issuer, e mudar de ambiente não pede
  variável nova.
- A trava por URL corta o laço de re-autenticação com dois recursos autenticados na mesma página.
- Um `401` em `/app/conta` volta a `/app/conta`, e não a `/app`.

Negativas:

- **Toda rota de `/app` passa a esperar o GET da conta.** API fora do ar, `client_id` errado no IdP
  ou conta desativada fecham a área, mesmo com o login funcionando.
- **I5 deixa de ser absoluto.** Um caminho da API ou das páginas que mude no IdP quebra a SPA sem
  aviso da descoberta. O IdP, por sua vez, conhece rotas da SPA (`/`, `/app/conta`, `/termos`,
  `/privacidade`), e mudá-las quebra a volta sem erro.
- **A SPA ganha superfície de escrita.** Um script injetado passa a editar o perfil e aceitar os
  termos em nome da pessoa. Emoldurada, a SPA pode ser induzida a clicar "Aceitar" ou "Reenviar".
- **A escrita depende de uma premissa do IdP:** a API é isenta de proteção contra falsificação de
  requisição entre sites (CSRF) só porque não aceita sessão.
- **A D-1 depende de quatro premissas.** Se uma cair sem a revisão, um `403` de scope vira erro
  genérico sem saída.
- **O formulário se perde num `401` durante o `PATCH`** (D-7).
- **No mesmo campo, vence a última escrita.** O `PATCH` leva só os campos alterados, e o contrato
  não tem precondição de versão: um campo mudado por outro caminho depois da carga é sobrescrito
  sem aviso.
- **O formulário também se perde numa nova busca que falha.** Como a D-6 fecha a área em qualquer
  erro do GET da conta, uma nova busca por foco que falhe (instabilidade, `429`) desmonta tudo sob
  `/app`, e o que estava digitado ou marcado se perde, como na D-7, sem envio nenhum.
- **A trava por URL não corta alternância.** Se dois recursos recusarem o token alternadamente, cada
  carga dispara um novo login.
- **Trocar a versão dos termos exige os dois lados,** e a janela em que o IdP aceite as duas versões
  não basta sozinha. A guarda só abre com `termos_versao` igual à vigente, e a SPA envia a própria
  versão: em qualquer ordem de troca, alguém fica preso no aceite. O critério de "aceito" durante a
  janela está em aberto, a decidir antes da primeira troca.
- **Dois `updated_at`:** inteiro na claim, ISO 8601 na API; schemas separados, nunca comparados.
- **O fake cresce:** API, contas em memória e CORS escritos à mão, mantidos à mão contra o IdP real.
- **Os `403` do GET da conta ganham uma requisição a mais** pela retentativa padrão (D-15).
- **Esta ADR emenda a 0008 e a 0004,** e quem as lê precisa do índice para chegar aqui.

## Alternativas consideradas

- **Manter a ADR 0012** — nenhuma superfície nova. Descartada: o IdP abre o autoatendimento, e a
  pessoa seguiria sem caminho até ele pela SPA.
- **Telas de senha na SPA, sobre a API** — uma interface só. Descartada: a senha passaria pela SPA,
  contra I8 e a segunda cláusula de I1.
- **Só links às páginas do IdP, sem API** — I1 e I5 intocados. Descartada: o IdP não tem página de
  perfil nem de aceite dos termos.
- **Caminhos da API numa variável `VITE_*` própria** — I5 sem exceção. Descartada: variável nova em
  todo ambiente (ADR 0005) para um valor que é sempre a origem do issuer mais um caminho fixo.
- **Tratar o `403` de scope como o `401`** — novo login. Descartada pela D-1: o novo login devolve o
  mesmo token e só soma uma ida e volta antes do mesmo erro.
- **Wrapper genérico com `RequestInit`** — mais flexível. Descartado pelo motivo da ADR 0008:
  restringir a escrita aos caminhos da API expressa I1 no código.
- **Manter o marcador único da ADR 0008** — menos código. Descartada pela D-14.
- **Devolver no aceite a versão vigente lida do GET** — o aceite nunca falharia. Descartada pela
  D-2: registraria como aceito um texto que a SPA não mostrou.
- **Textos dos termos em Markdown** — edição mais confortável. Descartada pela D-13: exigiria
  parser.
- **Login automático no `sub` divergente** — sem mensagem de erro na transição. Descartado pela
  D-12: um reload já resolve pelo SSO.
