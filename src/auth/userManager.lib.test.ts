// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// Diferente de userManager.test.ts (que mocka oidc-client-ts): aqui a lib é REAL. O que se prova
// é o contrato "Event.raise aguarda callbacks assíncronos antes de resolver" de que a ADR 0010
// depende (Area navega para "/" depois de `await signout()` assumindo que `anonymous` +
// `queryClient.clear()` já aconteceram). `^3.5.0` admite minor que mude isso; um mock nunca
// avisaria. jsdom: o stateStore default (sessionStorage) toca o DOM na construção do UserManager.

const fakeConfig = {
  oidc: {
    issuer: "http://idp.test/o",
    clientId: "spa-test",
    redirectUri: "http://app.test/callback",
    scope: "openid profile email",
  },
  idpAccountUrl: "http://idp.test/accounts",
};

beforeEach(() => {
  vi.resetModules();
  vi.doMock("../config", () => ({ config: fakeConfig }));
});

describe("userManager (oidc-client-ts real, sem rede)", () => {
  it("(a) signout() só resolve depois do callback assíncrono de userUnloaded; sessão some", async () => {
    const { User } = await import("oidc-client-ts");
    const { userManager, signout, restoreSession } = await import("./userManager");

    let flag = false;
    userManager.events.addUserUnloaded(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      flag = true;
    });

    // Há sessão: storeUser não passa por rede (só grava no userStore em memória).
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

    await signout();

    expect(flag).toBe(true); // asserção imediatamente após o await — sem tick extra
    await expect(restoreSession()).resolves.toBeNull();
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
});
