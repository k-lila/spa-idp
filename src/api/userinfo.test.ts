import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

// vi.hoisted: vi.mock sobe para o topo do arquivo, então a const referenciada na factory
// precisa subir junto para não cair em TDZ.
const { getUserInfoEndpoint } = vi.hoisted(() => ({ getUserInfoEndpoint: vi.fn() }));
vi.mock("../auth/userManager", () => ({
  userManager: { metadataService: { getUserInfoEndpoint } },
}));

const { authGet } = vi.hoisted(() => ({ authGet: vi.fn() }));
// Reexporta a classe real de UnauthorizedError (via importOriginal) para preservar instanceof;
// isolar userManager acima também isola config, que lançaria sem VITE_* no import real de http.ts.
vi.mock("./http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./http")>();
  return { ...actual, authGet };
});

import { fetchUserinfo } from "./userinfo";
import { UnauthorizedError } from "./http";

const ENDPOINT = "http://idp.test/o/userinfo/";

function fakeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserInfoEndpoint.mockResolvedValue(ENDPOINT);
});

describe("fetchUserinfo", () => {
  it("a) chama authGet com a URL do discovery", async () => {
    authGet.mockResolvedValue(fakeResponse({ sub: "u1", name: "Ana", email: "a@x" }));

    await fetchUserinfo("u1");

    expect(authGet).toHaveBeenCalledWith(ENDPOINT);
  });

  it("b) resolve com objeto contendo exatamente sub, name e email", async () => {
    authGet.mockResolvedValue(
      fakeResponse({ sub: "u1", name: "Ana", email: "a@x", iat: 1, sid: "s" }),
    );

    const claims = await fetchUserinfo("u1");

    expect(Object.keys(claims)).toEqual(["sub", "name", "email"]);
  });

  it("c) name vazio é aceito e preservado", async () => {
    authGet.mockResolvedValue(fakeResponse({ sub: "u1", name: "", email: "a@x" }));

    const claims = await fetchUserinfo("u1");

    expect(claims.name).toBe("");
  });

  it("d) sub divergente do id_token rejeita com Error que não é UnauthorizedError", async () => {
    authGet.mockResolvedValue(fakeResponse({ sub: "u2", name: "Ana", email: "a@x" }));

    await expect(fetchUserinfo("u1")).rejects.toBeInstanceOf(Error);
    await expect(fetchUserinfo("u1")).rejects.not.toBeInstanceOf(UnauthorizedError);
  });

  it("e) status 500 rejeita com Error não-UnauthorizedError e não lê o corpo", async () => {
    const json = vi.fn();
    authGet.mockResolvedValue({ ok: false, status: 500, json } as unknown as Response);

    await expect(fetchUserinfo("u1")).rejects.not.toBeInstanceOf(UnauthorizedError);
    expect(json).not.toHaveBeenCalled();
  });

  it("f) json() rejeitando (corpo não-JSON) propaga a rejeição", async () => {
    authGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError("corpo inválido")),
    } as unknown as Response);

    await expect(fetchUserinfo("u1")).rejects.toBeInstanceOf(Error);
  });

  it("g) corpo fora do contrato rejeita com ZodError", async () => {
    authGet.mockResolvedValueOnce(fakeResponse({ sub: "u1", name: "Ana" })); // sem email
    await expect(fetchUserinfo("u1")).rejects.toBeInstanceOf(ZodError);

    authGet.mockResolvedValueOnce(fakeResponse({ sub: "", name: "Ana", email: "a@x" })); // sub vazio
    await expect(fetchUserinfo("")).rejects.toBeInstanceOf(ZodError);
  });

  it("h) authGet rejeitando com UnauthorizedError propaga a MESMA instância", async () => {
    const err = new UnauthorizedError("sem sessão em memória");
    authGet.mockRejectedValue(err);

    await expect(fetchUserinfo("u1")).rejects.toBe(err);
  });
});
