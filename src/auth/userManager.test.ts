// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

// config.ts lança no import se faltarem VITE_*; mockamos para ter valores estáveis.
const fakeConfig = {
  oidc: {
    issuer: "http://idp.test/o",
    clientId: "spa-test",
    redirectUri: "http://app.test/callback",
    postLogoutRedirectUri: "http://app.test/",
    scope: "openid profile email",
  },
};

// getKeysEndpoint tem default próprio (não depende de rede) mas é aceito por parâmetro para os
// casos que precisam inspecionar a chamada (T-08: com que argumento, que URI ela devolve).
function mockOidcClientTs(
  signinRedirectCallback: ReturnType<typeof vi.fn>,
  removeUser: ReturnType<typeof vi.fn>,
  getKeysEndpoint: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue("http://idp.test/o/jwks"),
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
          metadataService: { getKeysEndpoint },
        };
      }),
    };
  });
  return { getKeysEndpoint };
}

beforeEach(() => {
  vi.resetModules();
  vi.doMock("../config", () => ({ config: fakeConfig }));
  // completeSignin() verifica o id_token (ADR 0013); por padrão a verificação passa e não
  // reformula os casos que não são sobre ela — T-09 sobrescreve com um rejeitado.
  vi.doMock("./idToken", () => ({
    verifyIdToken: vi.fn().mockResolvedValue(undefined),
    remoteJwks: vi.fn(),
  }));
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

  it("(b) profile válido, state ausente: resolve {claims,returnTo:'/app'}, não chama removeUser, e o id_token passa pela verificação via jwks da descoberta (I5)", async () => {
    const signinRedirectCallback = vi.fn().mockResolvedValue({
      id_token: "x.y.z",
      profile: { sub: "u1", name: "Ana", email: "ana@example.com", iat: 123 },
    });
    const removeUser = vi.fn();
    const { getKeysEndpoint } = mockOidcClientTs(signinRedirectCallback, removeUser);

    const { completeSignin } = await import("./userManager");
    const { verifyIdToken, remoteJwks } = await import("./idToken");

    await expect(completeSignin()).resolves.toEqual({
      claims: { sub: "u1", name: "Ana", email: "ana@example.com" },
      returnTo: "/app",
    });
    expect(removeUser).not.toHaveBeenCalled();

    expect(verifyIdToken).toHaveBeenCalledTimes(1);
    expect((verifyIdToken as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe("x.y.z");
    expect(getKeysEndpoint).toHaveBeenCalledWith(false); // I5: descoberta, não configuração estática
    expect(remoteJwks).toHaveBeenCalledWith("http://idp.test/o/jwks");
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

  it("(c2) id_token inválido (verifyIdToken rejeita): completeSignin propaga o MESMO erro — não ZodError —, e removeUser resolve antes da rejeição (T-09)", async () => {
    const order: string[] = [];
    const err = new TypeError("Failed to fetch");
    vi.doMock("./idToken", () => ({
      verifyIdToken: vi.fn().mockRejectedValue(err),
      remoteJwks: vi.fn(),
    })); // sobrescreve o mock do beforeEach só para este caso

    const signinRedirectCallback = vi.fn().mockResolvedValue({
      id_token: "x.y.z",
      profile: { sub: "u1" }, // inválido para o zod de propósito: se a rejeição fosse dele, seria ZodError
    });
    // Mesmo padrão do caso (a): removeUser deferido por macrotask denuncia um `removeUser()`
    // sem `await` em produção (o throw venceria a corrida e a asserção de ordem abaixo falharia).
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

    await expect(completeSignin()).rejects.toBe(err);
    order.push("rejected");

    expect(order).toEqual(["removeUser-start", "removeUser-end", "rejected"]);
    expect(removeUser).toHaveBeenCalledTimes(1);
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

describe("signup", () => {
  function mockOidcClientTsForSignup(signinRedirect: ReturnType<typeof vi.fn>) {
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

  it("(i) signup() chama signinRedirect 1x com prompt 'create', nonce não vazia e sem state", async () => {
    const signinRedirect = vi.fn().mockResolvedValue(undefined);
    mockOidcClientTsForSignup(signinRedirect);

    const { signup } = await import("./userManager");
    await signup();

    expect(signinRedirect).toHaveBeenCalledTimes(1);
    const arg = signinRedirect.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.prompt).toBe("create");
    expect(typeof arg.nonce).toBe("string");
    expect((arg.nonce as string).length).toBeGreaterThan(0);
    expect("state" in arg).toBe(false);
  });

  it("(ii) signin('/a') seguido de signup() antes de resolver: 1 chamada (a de signin) e mesma promessa", async () => {
    let resolveRedirect: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      resolveRedirect = resolve;
    });
    const signinRedirect = vi.fn().mockReturnValue(pending);
    mockOidcClientTsForSignup(signinRedirect);

    const { signin, signup } = await import("./userManager");
    const first = signin("/a");
    const second = signup();

    expect(second).toBe(first);
    expect(signinRedirect).toHaveBeenCalledTimes(1);
    const arg = signinRedirect.mock.calls[0]?.[0] as { state: unknown; prompt?: string };
    expect(arg.state).toEqual({ returnTo: "/a" });
    expect(arg.prompt).toBeUndefined();

    resolveRedirect();
    await Promise.all([first, second]);
  });

  it("(iii) depois de resolver, um novo signup() chama signinRedirect de novo", async () => {
    const signinRedirect = vi.fn().mockResolvedValue(undefined);
    mockOidcClientTsForSignup(signinRedirect);

    const { signup } = await import("./userManager");
    await signup();
    await signup();

    expect(signinRedirect).toHaveBeenCalledTimes(2);
  });
});

describe("signout", () => {
  function mockOidcClientTsForSignout(
    signoutRedirect: ReturnType<typeof vi.fn>,
    removeUser: ReturnType<typeof vi.fn>,
  ) {
    vi.doMock("oidc-client-ts", async (importOriginal) => {
      const actual = await importOriginal<typeof import("oidc-client-ts")>();
      return {
        ...actual,
        UserManager: vi.fn().mockImplementation(function () {
          return {
            signinRedirectCallback: vi.fn(),
            removeUser,
            signoutRedirect,
            signinRedirect: vi.fn(),
            getUser: vi.fn(),
            events: { addUserLoaded: vi.fn(() => vi.fn()) },
          };
        }),
      };
    });
  }

  // jsdom não deixa espionar location.reload; troca-se o `location` global por um objeto mínimo.
  const reload = vi.fn();
  beforeEach(() => {
    reload.mockClear();
    vi.stubGlobal("location", { reload });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("(i) signoutRedirect 1x, sem argumentos (sem state nem id_token_hint); ao resolver (bfcache), reload 1x", async () => {
    const signoutRedirect = vi.fn().mockResolvedValue(undefined);
    mockOidcClientTsForSignout(signoutRedirect, vi.fn());

    const { signout } = await import("./userManager");
    await signout();

    expect(signoutRedirect).toHaveBeenCalledTimes(1);
    expect(signoutRedirect).toHaveBeenCalledWith();
    expect(signoutRedirect.mock.calls[0]).toHaveLength(0);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("(ii) signoutRedirect rejeita: signout rejeita com o MESMO erro, sem reload e sem removeUser", async () => {
    const err = new Error("descoberta fora");
    const signoutRedirect = vi.fn().mockRejectedValue(err);
    const removeUser = vi.fn();
    mockOidcClientTsForSignout(signoutRedirect, removeUser);

    const { signout } = await import("./userManager");

    await expect(signout()).rejects.toBe(err);
    expect(reload).not.toHaveBeenCalled();
    expect(removeUser).not.toHaveBeenCalled();
  });

  it("(iii) reload só depois de signoutRedirect resolver", async () => {
    let resolveRedirect: () => void = () => {};
    const signoutRedirect = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRedirect = resolve;
      }),
    );
    mockOidcClientTsForSignout(signoutRedirect, vi.fn());

    const { signout } = await import("./userManager");
    const pending = signout();
    await Promise.resolve();

    expect(reload).not.toHaveBeenCalled();

    resolveRedirect();
    await pending;
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
