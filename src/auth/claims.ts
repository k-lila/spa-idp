import { z } from "zod";

// Contrato de claims do IdP (docs/contrato-idp.md). `sub` e `email`
// nunca são vazios (`email` é o identificador de login); `name` pode ser "" — vem de
// `get_full_name()`, que devolve vazio para usuário sem nome cadastrado. Claims extras
// (iat, exp, sid, ...) são toleradas e descartadas, nunca rejeitadas.
export const claimsSchema = z.object({
  sub: z.string().min(1),
  name: z.string(),
  email: z.string().min(1),
  // Opcionais: documentam o contrato sem o login depender delas; nenhuma tela as lê daqui
  // (ADR 0020, D-3). Tipo inesperado ou `null` é descartado (vira `undefined`), não recusa o
  // login. `updated_at` é epoch em segundos — na API de conta é ISO, outro schema.
  email_verified: z.boolean().optional().catch(undefined),
  nickname: z.string().optional().catch(undefined),
  updated_at: z.number().optional().catch(undefined),
});
export type Claims = z.infer<typeof claimsSchema>;
