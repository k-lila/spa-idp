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
  idpAccountUrl: "http://idp.test/accounts",
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

  it("(b) profile válido: resolve só com {sub,name,email} e não chama removeUser", async () => {
    const signinRedirectCallback = vi.fn().mockResolvedValue({
      profile: { sub: "u1", name: "Ana", email: "ana@example.com", iat: 123 },
    });
    const removeUser = vi.fn();
    mockOidcClientTs(signinRedirectCallback, removeUser);

    const { completeSignin } = await import("./userManager");

    await expect(completeSignin()).resolves.toEqual({
      sub: "u1",
      name: "Ana",
      email: "ana@example.com",
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
});
