# 0017. Fixar `VITE_OIDC_ISSUER` de produção na forma `https://<dominio-do-idp>/o`, sem barra final

## Status

Aceito — 2026-09-17

Revisão — 2026-09-29: referências a documentos de trabalho suprimidas; decisão inalterada (ver índice).

## Contexto

O IdP (Identity Provider) fixou o issuer em `{BASE_URL}/o` (ADR 0007 do IdP) e pediu confirmação
explícita antes de a primeira relying party (RP) integrar — depois disso a string é permanente
para efeitos práticos. O `docs/integracao-rp.md` do IdP diz que a forma está decidida e o
host é provisório, e que duas propriedades valem em qualquer implantação: termina em `/o`, e o
esquema é `https` se e somente se o IdP está atrás do proxy de terminação TLS (Transport Layer
Security). O acordo entre os projetos lista o issuer entre os valores que a SPA
recebe e fixa o host de produção num domínio próprio (`idp.<seu-dominio>`), nunca
num nome atribuído pela AWS.

Do lado da SPA o issuer é um literal em três papéis ao mesmo tempo: é o `authority` do
`UserManager`, de onde a biblioteca monta a URL de descoberta como
`authority + /.well-known/openid-configuration` — a forma da OIDC Discovery 1.0, a única que o IdP
serve; é o `issuer` de `verifyIdToken`, comparado byte a byte com a claim `iss` (ADR 0013); e I6
exige que venha de `VITE_OIDC_ISSUER` (ADR 0005). A biblioteca tolera barra final na descoberta;
o `jose` não a tolera no `iss`; `config.ts` valida só a sintaxe de URL — a barra final só falha
no callback, com a mensagem genérica (TASK-009, adiado). O valor difere por ambiente: fake em
`http://localhost:9000/o`, IdP real local em `http://localhost:8000/o`, produção com host ainda
não entregue.

`integracao-rp.md` recomenda ler o `issuer` da descoberta em vez de fixar um literal. A SPA não
pode: I6 e I4 exigem saber o issuer esperado antes de confiar em qualquer coisa que venha da rede
— o literal é o que dá sentido à verificação de `iss`.

## Decisão

Vamos fixar a forma do `VITE_OIDC_ISSUER` de produção: `https://` + host público do IdP + `/o`,
sem barra final, sem porta e sem outro path. Com isso a SPA aceita `{BASE_URL}/o` como permanente
— a confirmação que a ADR 0007 do IdP pede.

O host fica como `<dominio-do-idp>` até o IdP entregá-lo e não entra
no repositório: vai só no ambiente Production do painel da Vercel (ADR 0016). Em desenvolvimento,
`http://localhost:8000/o` no `.env.local`; o fake continua em `http://localhost:9000/o` no
`.env.example`.

Regra de conformidade: o valor tem de ser igual, byte a byte, ao `issuer` que a descoberta de
produção publica em `https://<host>/o/.well-known/openid-configuration` (verificação combinada
entre os projetos). Qualquer diferença — barra final, `http`, host da AWS — é erro de
configuração e aparece como falha no callback.

Contraparte: ADR 0007 do IdP e a ADR "issuer congelado", devida lá, que
pode citar esta por número. Nenhuma mudança de código nos dois lados.

## Consequências

Positivas:

- A confirmação que a ADR 0007 pedia existe; o IdP pode congelar o issuer.
- Um único valor a copiar, com forma verificável contra a descoberta.
- Zero código: `src/config.ts`, `src/auth/userManager.ts` e `src/auth/idToken.ts` inalterados.

Negativas:

- Issuer copiado, não descoberto: se o IdP mudar de host, a SPA precisa de valor novo no painel e
  de redeploy, e todo token vivo fica inválido até lá — a mesma consequência que a ADR 0007
  assume.
- Forma fixa, host em aberto: até a implantação nada em produção funciona, e `<dominio-do-idp>`
  segue como placeholder na documentação.
- Barra final continua detectável só no callback; a validação de forma em `config.ts` segue
  adiada (TASK-009).
- Se o IdP um dia adotar o subdomínio dedicado sem `/o` (alternativa da ADR 0007), é ADR nova
  aqui e reconfiguração de produção.

## Alternativas consideradas

- **Ler o issuer da descoberta** (`integracao-rp.md`) — descartada: circular; I6 e I4 exigem o
  valor esperado antes da rede.
- **Validar a forma no boot em `config.ts`** — fora desta decisão; segue adiada (TASK-009). A ADR
  0005 já assume validação só sintática.
- **Issuer na raiz do host, sem `/o`** — não é da SPA decidir; a ADR 0007 fixou, e a SPA aceita.
- **Fixar o host agora com valor presumido** (`idp.<dominio>`) — descartado: o IdP não entregou;
  um valor presumido no painel só adiaria a descoberta do erro para produção.
