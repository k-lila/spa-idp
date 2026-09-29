// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Diferente de userManager.test.ts (que mocka oidc-client-ts): aqui a lib é REAL. O que se prova
// é a ordem interna de `signoutRedirect()` de que a ADR 0019 depende: a lib esquece o usuário
// (`removeUser()` → `userUnloaded`, aguardando callbacks assíncronos) ANTES de ler o
// `end_session_endpoint` da descoberta; assim, se a descoberta falhar, a rejeição chega com a
// sessão local já morta e Area pode navegar para "/" com o alerta. `^3.5.0` admite minor que mude
// isso; um mock nunca avisaria. jsdom: o stateStore default (sessionStorage) toca o DOM na construção do UserManager.

const fakeConfig = {
  oidc: {
    issuer: "http://idp.test/o",
    clientId: "spa-test",
    redirectUri: "http://app.test/callback",
    postLogoutRedirectUri: "http://app.test/",
    scope: "openid profile email",
  },
};

beforeEach(() => {
  vi.resetModules();
  vi.doMock("../config", () => ({ config: fakeConfig }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

const PROFILE = {
  sub: "u1",
  name: "Ana",
  email: "ana@example.com",
  iss: "http://idp.test/o",
  aud: "spa-test",
  exp: 9999999999,
  iat: 0,
};

// Grava um usuário (sem rede), registra um listener de userUnloaded que anota a ordem e devolve
// a lista de eventos. A rejeição de signout() é anotada por quem chama.
async function setupSession() {
  const { User } = await import("oidc-client-ts");
  const mod = await import("./userManager");
  const order: string[] = [];
  // Deferido por macrotask: se a lib rejeitasse sem aguardar o callback, a ordem denunciaria.
  mod.userManager.events.addUserUnloaded(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    order.push("userUnloaded");
  });
  await mod.userManager.storeUser(
    new User({ access_token: "tok", token_type: "Bearer", profile: PROFILE }),
  );
  return { ...mod, order };
}

// Asserções comuns aos dois cenários de falha do signout (ADR 0019).
async function expectSignoutRejectedAfterUnload(
  ctx: Awaited<ReturnType<typeof setupSession>>,
): Promise<void> {
  const { signout, restoreSession, order } = ctx;
  await expect(signout()).rejects.toBeDefined();
  order.push("rejected");

  expect(order).toEqual(["userUnloaded", "rejected"]); // userUnloaded antes da rejeição
  await expect(restoreSession()).resolves.toBeNull();
  // sem `state`, a lib não grava estado de logout
  expect(Object.keys(sessionStorage).filter((key) => key.includes("state"))).toEqual([]);
  expect(sessionStorage.length).toBe(0);
}

describe("userManager (oidc-client-ts real, sem rede)", () => {
  it("(a1) signout() com a descoberta fora: userUnloaded dispara antes da rejeição; sem sessão e sem estado de logout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const ctx = await setupSession();

    await expectSignoutRejectedAfterUnload(ctx);
  });

  it("(a2) signout() com a descoberta sem end_session_endpoint: userUnloaded dispara antes da rejeição; sem sessão e sem estado de logout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            issuer: "http://idp.test/o",
            authorization_endpoint: "http://idp.test/o/auth",
            token_endpoint: "http://idp.test/o/token",
            jwks_uri: "http://idp.test/o/jwks",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const ctx = await setupSession();

    await expectSignoutRejectedAfterUnload(ctx);
  });

  it("(b) storeUser(user) não dispara addUserLoaded — só events.load dispara", async () => {
    const { User } = await import("oidc-client-ts");
    const { userManager } = await import("./userManager");

    const loaded = vi.fn();
    userManager.events.addUserLoaded(loaded);

    await userManager.storeUser(
      new User({
        access_token: "tok",
        token_type: "Bearer",
        profile: {
          sub: "u1",
          name: "Ana",
          email: "ana@example.com",
          iss: "http://idp.test/o",
          aud: "spa-test",
          exp: 9999999999,
          iat: 0,
        },
      }),
    );

    expect(loaded).not.toHaveBeenCalled();
  });

  it("(c) settings do UserManager: post_logout_redirect_uri, timeout finito e tokens fora de sessionStorage/localStorage (I3)", async () => {
    const { User } = await import("oidc-client-ts");
    const { userManager } = await import("./userManager");

    // requestTimeoutInSeconds: sem ele a descoberta e /o/token/ nunca rejeitam sozinhos (ADR 0015).
    expect(userManager.settings.requestTimeoutInSeconds).toBe(15);
    expect(userManager.settings.response_type).toBe("code");
    expect(userManager.settings.automaticSilentRenew).toBe(false);
    expect(userManager.settings.monitorSession).toBe(false);
    expect(userManager.settings.loadUserInfo).toBe(false);
    expect(userManager.settings.authority).toBe(fakeConfig.oidc.issuer);
    expect(userManager.settings.client_id).toBe(fakeConfig.oidc.clientId);
    expect(userManager.settings.redirect_uri).toBe(fakeConfig.oidc.redirectUri);
    expect(userManager.settings.scope).toBe(fakeConfig.oidc.scope);
    expect(userManager.settings.post_logout_redirect_uri).toBe("http://app.test/");

    // Mesmo objeto dos casos (a)/(b): storeUser não passa por rede.
    await userManager.storeUser(
      new User({
        access_token: "tok",
        token_type: "Bearer",
        profile: {
          sub: "u1",
          name: "Ana",
          email: "ana@example.com",
          iss: "http://idp.test/o",
          aud: "spa-test",
          exp: 9999999999,
          iat: 0,
        },
      }),
    );

    expect(Object.keys(sessionStorage).some((key) => key.startsWith("oidc.user:"))).toBe(false);
    expect(Object.keys(localStorage).some((key) => key.startsWith("oidc.user:"))).toBe(false);
  });
});
