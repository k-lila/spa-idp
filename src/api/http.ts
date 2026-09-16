import { signin, userManager } from "../auth/userManager";

export class UnauthorizedError extends Error {}

// Marcador booleano ("1"), não token — mesma categoria do `stateStore` da lib (ADR 0006); I3 não
// se aplica. Precisa sobreviver ao redirect para cortar o laço /app → IdP → /app → 401.
const REAUTH_KEY = "spa.reauth";

/**
 * GET com `Authorization: Bearer <access_token>` da sessão em memória. Só GET, sem `RequestInit`:
 * o token da RP lê identidade, nunca escreve (I1). `User` e token não saem deste módulo (ADR 0008).
 */
export async function authGet(url: string): Promise<Response> {
  const user = await userManager.getUser();
  // Sem sessão não é veredito do IdP: é assunto da guarda de rota (I8). Nada de signin() aqui.
  if (user === null) throw new UnauthorizedError("sem sessão em memória");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${user.access_token}` } });

  if (res.status === 401) {
    // Segundo 401 consecutivo na aba: o IdP emitiu token que o recurso continua recusando.
    if (sessionStorage.getItem(REAUTH_KEY) !== null) {
      throw new UnauthorizedError("userinfo recusou o token após re-auth");
    }
    sessionStorage.setItem(REAUTH_KEY, "1");
    // A promessa de signin() só resolve se a página voltar por bfcache: até lá a requisição fica
    // pendente e a página é descarregada — sem estado de erro, sem retentativa, sem tela intermediária.
    await signin();
    throw new UnauthorizedError("token recusado; re-auth disparada");
  }

  sessionStorage.removeItem(REAUTH_KEY);
  return res;
}
