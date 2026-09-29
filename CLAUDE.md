# CLAUDE.md — SPA

SPA em React + TypeScript + Tailwind que atua como **relying party (RP) OIDC** do provedor de
identidade (IdP) `monolito-idp` (Django), em origem diferente: a SPA na Vercel, o IdP servido pelo
Cloudflare Tunnel. Ela não coleta senha nem escreve no diretório de usuários: autentica por
redirect + PKCE, guarda tokens só em memória e exibe a identidade que o IdP afirma.

Está em produção na Vercel, integrada ao IdP real. Em desenvolvimento, a SPA fala com o IdP real
em `http://localhost:8000/o`, e os e2e rodam contra o IdP fake de `dev/idp-fake/`. Prefira sempre
a solução mais simples que cumpre o contrato; não faça over-engineering.

## Sobre o projeto

### Fonte de verdade (leia antes de decidir qualquer coisa)

| Documento | O que define |
|---|---|
| `docs/spa-nucleo.md` | Stack e invariantes I1–I8 (DEVE / NÃO DEVE). Nenhum agente diverge deles. |
| `docs/contrato-idp.md` | O contrato com o IdP: registro, variáveis, fluxo, claims, tempos de vida, o que muda nos dois lados |
| `docs/arquitetura.md` | Mapa de arquivos, camadas, estado, fluxos e ambientes |
| `docs/seguranca.md` | Controles implementados, modelo de ameaças e lacunas mapeadas |
| `docs/adr/` | Decisões formais (0001–0019; template em `template-adr.md`) |

### Decisões já fixadas

- **D1:** camada OIDC com `oidc-client-ts`, não PKCE à mão (ADR 0006); `jose` verifica o
  `id_token` (ADR 0013).
- **D2:** sem gestão de conta — nem na SPA, nem por link ao IdP, que não tem páginas de cadastro
  ou edição de perfil. Contas são criadas pelo admin do IdP (ADR 0012).
- **Sessão no reload:** redirect ao IdP + SSO; tokens só em memória, nada em `sessionStorage`; o
  `refresh_token` que o IdP devolve é recebido e nunca usado (ADR 0014).
- **Sair:** logout iniciado pela RP, `signoutRedirect()` sem `state` (ADR 0019).
- **Deploy:** Vercel com `vercel.json` e variáveis por ambiente; previews não autenticam
  (ADRs 0016, 0017, 0018).
- **IdP fake:** `oidc-provider` em `dev/idp-fake/`, só para os e2e (ADR 0004). e2e verde não
  prova a integração: ela só vale contra o IdP real.

### Decisões em aberto (não resolver unilateralmente)

As lacunas de `docs/seguranca.md` §4 (CSP, `refresh_token` em memória, auditoria de
dependências…) estão mapeadas, não decididas.

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
