import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import { config } from "../config";

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
 * Um único signinRedirect por vez: StrictMode dispara o efeito de RequireAuth duas vezes.
 * No code flow a lib só manda e confere `nonce` se ele vier por chamada (I4).
 */
export function signin(): Promise<void> {
  redirecting ??= userManager.signinRedirect({ nonce: crypto.randomUUID() }).finally(() => {
    redirecting = undefined;
  });
  return redirecting;
}

let callback: Promise<User> | undefined;
/**
 * Memoizado por vida do módulo: a 2ª execução do efeito (StrictMode) reaproveita a mesma troca
 * de code. Todo redirect é um carregamento de página novo, então o módulo renasce a cada login.
 */
export function completeSignin(): Promise<User> {
  callback ??= userManager.signinRedirectCallback();
  return callback;
}

/** Ponto de encaixe do plano §7.2. Hoje só consulta o store em memória: após reload responde null. */
export function restoreSession(): Promise<User | null> {
  return userManager.getUser();
}
