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

// config.ts lança no import se faltarem VITE_*; mockamos só o que http.ts lê, sem depender de .env.local.
vi.mock("../config", () => ({
  config: {
    idp: {
      api: {
        conta: "http://idp.test/api/conta/",
        confirmacao: "http://idp.test/api/conta/confirmacao/",
        termos: "http://idp.test/api/conta/termos/",
      },
    },
  },
}));

import { config } from "../config";
import { authGet, authSend, UnauthorizedError } from "./http";

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

  it("c) 401 sem marcador grava a URL do recurso, chama signin com a URL atual inteira e fica pendente", async () => {
    history.pushState({}, "", "/app/conta?x=1#h");
    getUser.mockResolvedValue({ access_token: "tok" });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    const promise = authGet("http://recurso.test/x");

    const race = await Promise.race([promise.then(() => "settled"), pendingMarker("pending")]);

    expect(race).toBe("pending");
    expect(sessionStorage.getItem(REAUTH_KEY)).toBe("http://recurso.test/x");
    expect(signin).toHaveBeenCalledTimes(1);
    expect(signin).toHaveBeenCalledWith("/app/conta?x=1#h");
  });

  it("d) 401 com marcador da MESMA URL rejeita direto, sem signin, e mantém o marcador", async () => {
    sessionStorage.setItem(REAUTH_KEY, "http://recurso.test/x");
    getUser.mockResolvedValue({ access_token: "tok" });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    const race = await Promise.race([
      authGet("http://recurso.test/x").catch((e: unknown) => e),
      pendingMarker("pending"),
    ]);

    expect(race).toBeInstanceOf(UnauthorizedError);
    expect(signin).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(REAUTH_KEY)).toBe("http://recurso.test/x");
  });

  it("d) 401 com marcador de OUTRA URL chama signin e sobrescreve o marcador (por URL, não booleano)", async () => {
    sessionStorage.setItem(REAUTH_KEY, "http://recurso.test/outro");
    getUser.mockResolvedValue({ access_token: "tok" });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    const promise = authGet("http://recurso.test/x");
    const race = await Promise.race([promise.then(() => "settled"), pendingMarker("pending")]);

    expect(race).toBe("pending");
    expect(signin).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(REAUTH_KEY)).toBe("http://recurso.test/x");
  });

  it("e) resposta não-401 na MESMA URL devolve o Response e remove o marcador, com 200 ou 500", async () => {
    getUser.mockResolvedValue({ access_token: "tok" });

    sessionStorage.setItem(REAUTH_KEY, "http://recurso.test/x");
    const ok = new Response(null, { status: 200 });
    vi.mocked(fetch).mockResolvedValueOnce(ok);
    await expect(authGet("http://recurso.test/x")).resolves.toBe(ok);
    expect(sessionStorage.getItem(REAUTH_KEY)).toBeNull();

    sessionStorage.setItem(REAUTH_KEY, "http://recurso.test/x");
    const serverError = new Response(null, { status: 500 });
    vi.mocked(fetch).mockResolvedValueOnce(serverError);
    await expect(authGet("http://recurso.test/x")).resolves.toBe(serverError);
    expect(sessionStorage.getItem(REAUTH_KEY)).toBeNull();
  });

  it("e) sucesso de OUTRA URL devolve o Response e MANTÉM o marcador", async () => {
    getUser.mockResolvedValue({ access_token: "tok" });
    sessionStorage.setItem(REAUTH_KEY, "http://recurso.test/outro");
    const ok = new Response(null, { status: 200 });
    vi.mocked(fetch).mockResolvedValueOnce(ok);

    await expect(authGet("http://recurso.test/x")).resolves.toBe(ok);

    expect(sessionStorage.getItem(REAUTH_KEY)).toBe("http://recurso.test/outro");
  });

  it("T-04) conta 200, userinfo 401 (re-auth), volta, conta 200, userinfo 401 rejeita: signin 1x no total", async () => {
    getUser.mockResolvedValue({ access_token: "tok" });
    const conta = "http://recurso.test/conta";
    const userinfo = "http://recurso.test/userinfo";
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(authGet(conta)).resolves.toBeInstanceOf(Response);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const first = authGet(userinfo);
    expect(await Promise.race([first.then(() => "settled"), pendingMarker("pending")])).toBe(
      "pending",
    );
    expect(signin).toHaveBeenCalledTimes(1);

    // Volta do IdP: a trava de userinfo sobrevive ao sucesso de outro recurso.
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(authGet(conta)).resolves.toBeInstanceOf(Response);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const race = await Promise.race([
      authGet(userinfo).catch((e: unknown) => e),
      pendingMarker("pending"),
    ]);
    expect(race).toBeInstanceOf(UnauthorizedError);

    expect(signin).toHaveBeenCalledTimes(1);
  });

  it("T-06) 403 insufficient_scope devolve o mesmo Response, sem signin e sem tocar no marcador", async () => {
    getUser.mockResolvedValue({ access_token: "tok" });
    const forbidden = new Response(null, {
      status: 403,
      headers: { "WWW-Authenticate": 'Bearer error="insufficient_scope", scope="conta"' },
    });
    vi.mocked(fetch).mockResolvedValue(forbidden);

    await expect(authGet("http://recurso.test/x")).resolves.toBe(forbidden);

    expect(signin).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(REAUTH_KEY)).toBeNull();
    expect(sessionStorage).toHaveLength(0);
  });
});

describe("authSend", () => {
  it("(i) PATCH com json: URL de config.idp.api, body serializado e Content-Type", async () => {
    getUser.mockResolvedValue({ access_token: "tok" });
    const response = new Response(null, { status: 200 });
    vi.mocked(fetch).mockResolvedValue(response);

    await expect(authSend("PATCH", "conta", { nickname: "x" })).resolves.toBe(response);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(config.idp.api.conta, {
      method: "PATCH",
      body: '{"nickname":"x"}',
      headers: { Authorization: "Bearer tok", "Content-Type": "application/json" },
    });
  });

  it("(ii) POST sem json: sem body e sem Content-Type", async () => {
    getUser.mockResolvedValue({ access_token: "tok" });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await authSend("POST", "confirmacao");

    expect(fetch).toHaveBeenCalledWith(config.idp.api.confirmacao, {
      method: "POST",
      headers: { Authorization: "Bearer tok" },
    });
  });

  it("(iii) nenhum init tem a chave credentials", async () => {
    getUser.mockResolvedValue({ access_token: "tok" });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await authSend("PATCH", "conta", { nickname: "x" });
    await authSend("POST", "confirmacao");
    await authGet("http://recurso.test/x");

    expect(fetch).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(fetch).mock.calls) {
      expect(call[1]).not.toHaveProperty("credentials");
    }
  });

  it("(iv) 401 grava a URL da API no marcador e chama signin", async () => {
    history.pushState({}, "", "/app/conta");
    getUser.mockResolvedValue({ access_token: "tok" });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    const promise = authSend("PATCH", "conta", { nickname: "x" });
    const race = await Promise.race([promise.then(() => "settled"), pendingMarker("pending")]);

    expect(race).toBe("pending");
    expect(sessionStorage.getItem(REAUTH_KEY)).toBe(config.idp.api.conta);
    expect(signin).toHaveBeenCalledTimes(1);
    expect(signin).toHaveBeenCalledWith("/app/conta");
  });
});
