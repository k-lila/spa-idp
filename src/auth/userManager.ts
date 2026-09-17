import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import { config } from "../config";
import { claimsSchema, type Claims } from "./claims";
import { remoteJwks, verifyIdToken } from "./idToken";

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
  automaticSilentRenew: false, // default da v3 é true e usaria o refresh_token (ADR 0014)
  monitorSession: false, // check-session iframe: inexistente no fake, cross-site em prod
  loadUserInfo: false, // userinfo é etapa 5
  requestTimeoutInSeconds: 15, // descoberta e /o/token/ rejeitam em tempo finito (contrato §7 item 7; ADR 0015)
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
 * Verifica o `id_token` (I4) e valida as claims (I7); em qualquer falha descarta os tokens da
 * tentativa antes de rejeitar (ADRs 0007, 0013).
 */
export function completeSignin(): Promise<{ claims: Claims; returnTo: string }> {
  // A lib grava o User e emite `userLoaded` antes de resolver: o contexto fica `authenticated`
  // até a verificação terminar. Inofensivo porque em /callback só Callback está montada e
  // `removeUser()` emite `userUnloaded` (ADR 0007; a janela cresce com a rede, ADR 0013).
  callback ??= userManager.signinRedirectCallback().then(async (user) => {
    try {
      const jwksUri = await userManager.metadataService.getKeysEndpoint(false); // I5: da descoberta
      // `?? ""` só satisfaz o tipo: a lib já rejeita resposta openid sem id_token antes de resolver.
      await verifyIdToken(user.id_token ?? "", remoteJwks(jwksUri));
      return { claims: claimsSchema.parse(user.profile), returnTo: internalPath(user.state) };
    } catch (error) {
      await userManager.removeUser(); // I3: nada da tentativa fica no userStore
      throw error;
    }
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

/**
 * Sessão no reload é por redirect + SSO (ADR 0014): só consulta o store em memória; após reload
 * responde null e a guarda vai ao IdP.
 */
export function restoreSession(): Promise<User | null> {
  return userManager.getUser();
}
