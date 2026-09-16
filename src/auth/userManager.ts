import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import { config } from "../config";
import { claimsSchema, type Claims } from "./claims";

// Único ponto de contato com a biblioteca (ADR 0006).
export const userManager = new UserManager({
  authority: config.oidc.issuer, // I5: só o issuer; o resto vem do discovery
  client_id: config.oidc.clientId,
  redirect_uri: config.oidc.redirectUri,
  response_type: "code", // I2 (default da v3, explícito porque é contrato)
  scope: config.oidc.scope,
  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }), // I3: tokens só em memória
  // stateStore: default (sessionStorage) — guarda state/nonce/code_verifier SÓ durante o redirect
  // (a página é descarregada; memória não sobreviveria). Não é token; plano §5 permite.
  automaticSilentRenew: false, // default da v3 é true e usaria o refresh_token → decide §7.2
  monitorSession: false, // check-session iframe: inexistente no fake, cross-site em prod
  loadUserInfo: false, // userinfo é etapa 5
});

let redirecting: Promise<void> | undefined;
/**
 * Um único signinRedirect por vez: StrictMode dispara o efeito de RequireAuth duas vezes, e a
 * primeira chamada define o destino. No code flow a lib só manda e confere `nonce` se ele vier
 * por chamada (I4). O destino viaja no `state` do pedido, que a lib guarda e apaga sozinha
 * (ADR 0011); sem destino, o callback cai em /app.
 */
export function signin(returnTo?: string): Promise<void> {
  redirecting ??= userManager
    .signinRedirect({
      nonce: crypto.randomUUID(),
      state: returnTo === undefined ? undefined : { returnTo },
    })
    .finally(() => {
      redirecting = undefined;
    });
  return redirecting;
}

let callback: Promise<{ claims: Claims; returnTo: string }> | undefined;
/**
 * Memoizado por vida do módulo: a 2ª execução do efeito (StrictMode) reaproveita a mesma troca
 * de code. Todo redirect é um carregamento de página novo, então o módulo renasce a cada login.
 * Valida as claims (I7) e, se rejeitadas, descarta os tokens da tentativa antes de falhar.
 */
export function completeSignin(): Promise<{ claims: Claims; returnTo: string }> {
  callback ??= userManager.signinRedirectCallback().then(async (user) => {
    const parsed = claimsSchema.safeParse(user.profile);
    if (!parsed.success) {
      await userManager.removeUser(); // I3: nada da tentativa fica no userStore
      throw parsed.error;
    }
    return { claims: parsed.data, returnTo: internalPath(user.state) };
  });
  return callback;
}

/**
 * `user.state` é `unknown` e veio do sessionStorage: só vira navegação se for caminho desta
 * origem (ADR 0011). Resolver por URL, não por prefixo — `//host` e `/\host` passam num
 * `startsWith("/")` e o react-router os entrega a `location.assign`.
 */
function internalPath(state: unknown): string {
  const raw =
    typeof state === "object" && state !== null && "returnTo" in state ? state.returnTo : undefined;
  if (typeof raw !== "string") return "/app";
  let url: URL;
  try {
    url = new URL(raw, window.location.origin);
  } catch {
    return "/app";
  }
  return url.origin === window.location.origin ? url.pathname + url.search + url.hash : "/app";
}

/** Só esquece os tokens em memória; nada vai ao IdP (plano §2.4, ADR 0010). Resolve após `userUnloaded`. */
export function signout(): Promise<void> {
  return userManager.removeUser();
}

/** Ponto de encaixe do plano §7.2. Hoje só consulta o store em memória: após reload responde null. */
export function restoreSession(): Promise<User | null> {
  return userManager.getUser();
}
