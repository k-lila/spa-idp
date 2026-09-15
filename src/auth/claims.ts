import { z } from "zod";

// Contrato de claims do monolito-idp (docs/backend-mapa-comportamento.md). `sub` e `email`
// nunca são vazios (`email` é o identificador de login); `name` pode ser "" — vem de
// `get_full_name()`, que devolve vazio para usuário sem nome cadastrado. Claims extras
// (iat, exp, sid, ...) são toleradas e descartadas, nunca rejeitadas.
export const claimsSchema = z.object({
  sub: z.string().min(1),
  name: z.string(),
  email: z.string().min(1),
});
export type Claims = z.infer<typeof claimsSchema>;
