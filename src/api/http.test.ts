// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock é hoisted para o topo do arquivo; vi.hoisted garante que estas const também subam
// junto, evitando o TDZ de referenciá-las direto na factory (userManager.getUser, signin).
const { getUser, signin } = vi.hoisted(() => ({
  getUser: vi.fn(),
  // signin() nunca assenta neste arquivo: authGet() aguarda signin() antes do throw
  // (diretriz 2), e o teste (c) precisa ver a promessa de authGet ainda pendente depois do 401.
  signin: vi.fn(() => new Promise<void>(() => {})),
}));

vi.mock("../auth/userManager", () => ({
  userManager: { getUser },
  signin,
}));

import { authGet, UnauthorizedError } from "./http";

const REAUTH_KEY = "spa.reauth";

function pendingMarker<T>(value: T, ms = 50): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authGet", () => {
  it("a) monta GET com Authorization e devolve o mesmo Response", async () => {
    getUser.mockResolvedValue({ access_token: "tok" });
    const response = new Response(null, { status: 200 });
    vi.mocked(fetch).mockResolvedValue(response);

    const result = await authGet("http://recurso.test/x");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("http://recurso.test/x", {
      headers: { Authorization: "Bearer tok" },
    });
    expect(result).toBe(response);
  });

  it("b) sem sessão em memória rejeita com UnauthorizedError sem chamar fetch nem signin", async () => {
    getUser.mockResolvedValue(null);

    await expect(authGet("http://recurso.test/x")).rejects.toBeInstanceOf(UnauthorizedError);

    expect(fetch).not.toHaveBeenCalled();
    expect(signin).not.toHaveBeenCalled();
  });

  it("c) 401 sem marcador grava o marcador e aguarda signin() antes de rejeitar", async () => {
    getUser.mockResolvedValue({ access_token: "tok" });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    const promise = authGet("http://recurso.test/x");

    const race = await Promise.race([promise.then(() => "settled"), pendingMarker("pending")]);

    expect(race).toBe("pending");
    expect(sessionStorage.getItem(REAUTH_KEY)).toBe("1");
    expect(signin).toHaveBeenCalledTimes(1);
  });

  it("d) 401 com marcador já presente rejeita direto, sem chamar signin", async () => {
    sessionStorage.setItem(REAUTH_KEY, "1");
    getUser.mockResolvedValue({ access_token: "tok" });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    await expect(authGet("http://recurso.test/x")).rejects.toBeInstanceOf(UnauthorizedError);

    expect(signin).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(REAUTH_KEY)).toBe("1");
  });

  it("e) resposta não-401 devolve o Response e remove o marcador, com 200 ou 500", async () => {
    getUser.mockResolvedValue({ access_token: "tok" });

    sessionStorage.setItem(REAUTH_KEY, "1");
    const ok = new Response(null, { status: 200 });
    vi.mocked(fetch).mockResolvedValueOnce(ok);
    await expect(authGet("http://recurso.test/x")).resolves.toBe(ok);
    expect(sessionStorage.getItem(REAUTH_KEY)).toBeNull();

    sessionStorage.setItem(REAUTH_KEY, "1");
    const serverError = new Response(null, { status: 500 });
    vi.mocked(fetch).mockResolvedValueOnce(serverError);
    await expect(authGet("http://recurso.test/x")).resolves.toBe(serverError);
    expect(sessionStorage.getItem(REAUTH_KEY)).toBeNull();
  });
});
