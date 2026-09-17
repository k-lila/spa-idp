// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

// config.ts lança no import se faltarem VITE_*; mockamos para ter valores estáveis.
const fakeConfig = {
  oidc: {
    issuer: "http://idp.test/o",
    clientId: "spa-test",
    redirectUri: "http://app.test/callback",
    scope: "openid profile email",
  },
};

function mockOidcClientTs(
  signinRedirectCallback: ReturnType<typeof vi.fn>,
  removeUser: ReturnType<typeof vi.fn>,
) {
  vi.doMock("oidc-client-ts", async (importOriginal) => {
    const actual = await importOriginal<typeof import("oidc-client-ts")>();
    return {
      ...actual,
      // Função normal, não arrow: precisa ser utilizável com `new` (o vitest@5 exige que a
      // mockImplementation seja de fato construível quando o alvo mockado é instanciado via `new`).
      UserManager: vi.fn().mockImplementation(function () {
        return {
          signinRedirectCallback,
          removeUser,
          signinRedirect: vi.fn(),
          getUser: vi.fn(),
          events: { addUserLoaded: vi.fn(() => vi.fn()) },
        };
      }),
    };
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.doMock("../config", () => ({ config: fakeConfig }));
});

describe("completeSignin", () => {
  it("(a) profile inválido: rejeita com ZodError e removeUser resolve antes da rejeição", async () => {
    const order: string[] = [];
    const signinRedirectCallback = vi.fn().mockResolvedValue({ profile: { sub: "u1" } });
    // Deferida por macrotask (setTimeout), não por microtask (Promise.resolve()): assim, se o
    // `await userManager.removeUser()` de userManager.ts virar uma chamada sem `await`, o throw
    // corre na mesma volta de microtasks e vence a corrida contra este removeUser — a asserção de
    // ordem abaixo denuncia a regressão. Com `Promise.resolve()` a corrida empatava e o teste
    // passava também sem o `await` de produção.
    const removeUser = vi.fn().mockImplementation(() => {
      order.push("removeUser-start");
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          order.push("removeUser-end");
          resolve();
        }, 0);
      });
    });
    mockOidcClientTs(signinRedirectCallback, removeUser);

    const { completeSignin } = await import("./userManager");

    await expect(completeSignin()).rejects.toBeInstanceOf(ZodError);
    order.push("rejected");

    expect(order).toEqual(["removeUser-start", "removeUser-end", "rejected"]);
    expect(removeUser).toHaveBeenCalledTimes(1);
  });

  it("(b) profile válido, state ausente: resolve {claims,returnTo:'/app'} e não chama removeUser", async () => {
    const signinRedirectCallback = vi.fn().mockResolvedValue({
      profile: { sub: "u1", name: "Ana", email: "ana@example.com", iat: 123 },
    });
    const removeUser = vi.fn();
    mockOidcClientTs(signinRedirectCallback, removeUser);

    const { completeSignin } = await import("./userManager");

    await expect(completeSignin()).resolves.toEqual({
      claims: { sub: "u1", name: "Ana", email: "ana@example.com" },
      returnTo: "/app",
    });
    expect(removeUser).not.toHaveBeenCalled();
  });

  it("(c) signinRedirectCallback rejeita: completeSignin propaga o mesmo erro e não chama removeUser", async () => {
    const originalError = new Error("state mismatch");
    const signinRedirectCallback = vi.fn().mockRejectedValue(originalError);
    const removeUser = vi.fn();
    mockOidcClientTs(signinRedirectCallback, removeUser);

    const { completeSignin } = await import("./userManager");

    await expect(completeSignin()).rejects.toBe(originalError);
    expect(removeUser).not.toHaveBeenCalled();
  });

  it("(d) duas chamadas seguidas devolvem a mesma promessa e signinRedirectCallback roda 1x", async () => {
    const signinRedirectCallback = vi.fn().mockResolvedValue({
      profile: { sub: "u1", name: "Ana", email: "ana@example.com" },
    });
    const removeUser = vi.fn();
    mockOidcClientTs(signinRedirectCallback, removeUser);

    const { completeSignin } = await import("./userManager");

    const first = completeSignin();
    const second = completeSignin();

    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(signinRedirectCallback).toHaveBeenCalledTimes(1);
  });

  describe("internalPath (via returnTo do state)", () => {
    it.each([
      ["/app?x=1#h", "/app?x=1#h"],
      ["https://evil.example/x", "/app"],
      ["//evil.example", "/app"],
      ["/\\evil.example", "/app"],
      ["javascript:alert(1)", "/app"],
    ])("state.returnTo=%j → %j", async (raw, expected) => {
      const signinRedirectCallback = vi.fn().mockResolvedValue({
        profile: { sub: "u1", name: "Ana", email: "ana@example.com" },
        state: { returnTo: raw },
      });
      const removeUser = vi.fn();
      mockOidcClientTs(signinRedirectCallback, removeUser);

      const { completeSignin } = await import("./userManager");

      await expect(completeSignin()).resolves.toEqual({
        claims: { sub: "u1", name: "Ana", email: "ana@example.com" },
        returnTo: expected,
      });
    });

    it.each([[{ returnTo: 42 }], [{}], ["string"], [undefined]])(
      "state malformado %j → /app",
      async (state) => {
        const signinRedirectCallback = vi.fn().mockResolvedValue({
          profile: { sub: "u1", name: "Ana", email: "ana@example.com" },
          state,
        });
        const removeUser = vi.fn();
        mockOidcClientTs(signinRedirectCallback, removeUser);

        const { completeSignin } = await import("./userManager");

        await expect(completeSignin()).resolves.toEqual({
          claims: { sub: "u1", name: "Ana", email: "ana@example.com" },
          returnTo: "/app",
        });
      },
    );

    it("returnTo desta mesma origem preserva path+search+hash", async () => {
      const raw = `${window.location.origin}/outra?y=2#z`;
      const signinRedirectCallback = vi.fn().mockResolvedValue({
        profile: { sub: "u1", name: "Ana", email: "ana@example.com" },
        state: { returnTo: raw },
      });
      const removeUser = vi.fn();
      mockOidcClientTs(signinRedirectCallback, removeUser);

      const { completeSignin } = await import("./userManager");

      await expect(completeSignin()).resolves.toEqual({
        claims: { sub: "u1", name: "Ana", email: "ana@example.com" },
        returnTo: "/outra?y=2#z",
      });
    });
  });
});

describe("signin", () => {
  function mockOidcClientTsForSignin(signinRedirect: ReturnType<typeof vi.fn>) {
    vi.doMock("oidc-client-ts", async (importOriginal) => {
      const actual = await importOriginal<typeof import("oidc-client-ts")>();
      return {
        ...actual,
        UserManager: vi.fn().mockImplementation(function () {
          return {
            signinRedirectCallback: vi.fn(),
            removeUser: vi.fn(),
            signinRedirect,
            getUser: vi.fn(),
            events: { addUserLoaded: vi.fn(() => vi.fn()) },
          };
        }),
      };
    });
  }

  it("signin('/app?x=1') chama signinRedirect com nonce não vazia e state com o returnTo", async () => {
    const signinRedirect = vi.fn().mockResolvedValue(undefined);
    mockOidcClientTsForSignin(signinRedirect);

    const { signin } = await import("./userManager");
    await signin("/app?x=1");

    expect(signinRedirect).toHaveBeenCalledTimes(1);
    const arg = signinRedirect.mock.calls[0]?.[0] as { nonce: string; state: unknown };
    expect(typeof arg.nonce).toBe("string");
    expect(arg.nonce.length).toBeGreaterThan(0);
    expect(arg.state).toEqual({ returnTo: "/app?x=1" });
  });

  it("signin() sem argumento manda state undefined", async () => {
    const signinRedirect = vi.fn().mockResolvedValue(undefined);
    mockOidcClientTsForSignin(signinRedirect);

    const { signin } = await import("./userManager");
    await signin();

    const arg = signinRedirect.mock.calls[0]?.[0] as { state: unknown };
    expect(arg.state).toBeUndefined();
  });

  it("signin('/a') seguido de signin('/b') antes de resolver: 1 chamada com '/a' e mesma promessa", async () => {
    let resolveRedirect: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      resolveRedirect = resolve;
    });
    const signinRedirect = vi.fn().mockReturnValue(pending);
    mockOidcClientTsForSignin(signinRedirect);

    const { signin } = await import("./userManager");
    const first = signin("/a");
    const second = signin("/b");

    expect(first).toBe(second);
    expect(signinRedirect).toHaveBeenCalledTimes(1);
    const arg = signinRedirect.mock.calls[0]?.[0] as { state: unknown };
    expect(arg.state).toEqual({ returnTo: "/a" });

    resolveRedirect();
    await Promise.all([first, second]);
  });
});
