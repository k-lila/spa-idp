# CLAUDE.md — nova_api_SPA

Sandbox exploratório. Nada aqui é compromisso de produção: prefira sempre a solução mais simples e eficiente
que funciona. Não faça over-engineering.

## Sobre o projeto

SPA em React + TypeScript + Tailwind que atua como **Relying Party OIDC** do IdP
`k-lila/monolito-idp` (Django), em origem diferente (Vercel × Render/AWS). Ela não colhe
senha nem escreve no diretório de usuários: autentica por redirect + PKCE, guarda tokens
em memória e renderiza a identidade afirmada pelo IdP.

Ainda não há código. O back-end está offline e sem endereço; o desenvolvimento roda contra
um IdP fake local.

### Fonte de verdade (leia antes de decidir qualquer coisa)

| Documento | O que define |
|---|---|
| `docs/spa-nucleo.md` | Stack e invariantes I1–I8 (DEVE / NÃO DEVE). Nenhum agente diverge deles. |
| `docs/contrato-frontend.md` | O que a SPA cumpre para integrar o IdP real: contrato, implementação pendente, checklist |
| `docs/plano-pre-implementacao.md` | Fluxo de UX, rotas, estrutura, ordem de implementação |
| `docs/adr/` | Decisões formais (template em `template-adr.md`) |

### Decisões já fixadas

- **D1:** camada OIDC com `oidc-client-ts`, não PKCE à mão.
- **D2 (emendada pela ADR 0012):** sem gestão de conta nesta fase — nem na SPA, nem por link
  ao IdP, que não tem páginas de cadastro ou edição de perfil. Contas são criadas pelo admin
  do IdP.
- **Dev sem back-end:** IdP fake local em `dev/idp-fake/` (`oidc-provider`).

### Decisões em aberto (não resolver unilateralmente)

Listadas em `docs/plano-pre-implementacao.md`, §7: mecanismo de sessão no reload (§7.2).

## Regras de trabalho

### Restrições explícitas

- Não refatore código fora do escopo explícito da tarefa pedida;
- Não adicione tratamento de erro para cenários impossíveis;
- Não crie nem modifique arquivos sem que seja pedido ou autorizado explicitamente;

### Regras gerais

- Pergunte antes de agir se a tarefa tiver mais de 2 arquivos envolvidos;
- Antes de cada alteração no código apresente um relatório que aponte claramente: 1) razões dos
  novos códigos e/ou das modificações; 2) arquivos a serem criados, se houver; 3) arquivos a serem
  modificados, se houver;
- Dê um panorama simples e resumido (não mais que 2 linhas) sobre as opções fornecidas ao elaborar perguntas ou opções de resposta. Cada opção deve ser acompanhada de ao menos 1 pró e 1 contra;
