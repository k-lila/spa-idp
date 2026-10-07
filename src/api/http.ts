import { signin, userManager } from "../auth/userManager";
import { config } from "../config";

export class UnauthorizedError extends Error {}

// Guarda a URL do recurso que recebeu o 401 — não token, mesma categoria do `stateStore` da lib
// (ADR 0006); I3 não se aplica. Precisa sobreviver ao redirect para cortar o laço
// /app → IdP → /app → 401. Por URL, não booleano: o sucesso de outro recurso da mesma página não
// pode apagar a trava (ADR 0020, D-14).
const REAUTH_KEY = "spa.reauth";

type Write = { method: "PATCH" | "POST"; body?: string };

/**
 * Leitura com `Authorization: Bearer <access_token>` da sessão em memória, sem `RequestInit`.
 * `User` e token não saem deste módulo (ADR 0008).
 */
export function authGet(url: string): Promise<Response> {
  return authFetch(url);
}

/**
 * Escrita só na API de conta (I1, ADR 0020): o destino é uma chave de `config.idp.api`, nunca uma
 * URL, e escrever em outro recurso com o token da RP exige alterar este módulo.
 */
export function authSend(
  method: Write["method"],
  resource: keyof typeof config.idp.api,
  json?: unknown,
): Promise<Response> {
  return authFetch(
    config.idp.api[resource],
    json === undefined ? { method } : { method, body: JSON.stringify(json) },
  );
}

async function authFetch(url: string, write?: Write): Promise<Response> {
  const user = await userManager.getUser();
  // Sem sessão não é veredito do IdP: é assunto da guarda de rota (I8). Nada de signin() aqui.
  if (user === null) throw new UnauthorizedError("sem sessão em memória");

  const headers: Record<string, string> = { Authorization: `Bearer ${user.access_token}` };
  if (write?.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { ...write, headers });

  if (res.status === 401) {
    // Segundo 401 nesta URL: o IdP emitiu token que o recurso continua recusando.
    if (sessionStorage.getItem(REAUTH_KEY) === url) {
      throw new UnauthorizedError(`${url} recusou o token após re-auth`);
    }
    sessionStorage.setItem(REAUTH_KEY, url);
    // Volta à página atual, inteira; o destino passa pela regra da ADR 0011 no callback. A promessa
    // de signin() só resolve se a página voltar por bfcache: até lá a requisição fica pendente e a
    // página é descarregada — sem estado de erro, sem retentativa, sem tela intermediária.
    await signin(location.pathname + location.search + location.hash);
    throw new UnauthorizedError("token recusado; re-auth disparada");
  }

  if (sessionStorage.getItem(REAUTH_KEY) === url) sessionStorage.removeItem(REAUTH_KEY);
  return res;
}
