// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const { authGet, authSend } = vi.hoisted(() => ({ authGet: vi.fn(), authSend: vi.fn() }));
vi.mock("./http", () => ({ authGet, authSend }));

// config.ts lança no import se faltarem VITE_*; mockamos só o que conta.ts lê (como em http.test.ts).
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
import {
  ContaError,
  fetchConta,
  mensagemDoErro,
  useAceitarTermos,
  useConta,
  useEditarConta,
  useReenviarConfirmacao,
} from "./conta";

const CONTA = {
  sub: "u1",
  email: "a@x.com",
  email_verified: true,
  first_name: "Ana",
  last_name: "Silva",
  nickname: "ana",
  date_joined: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  senha_alterada_em: null,
  termos_versao: "1",
  termos_versao_vigente: "1",
};

function resposta(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json:
      body === undefined
        ? vi.fn().mockRejectedValue(new SyntaxError("sem corpo"))
        : vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("fetchConta", () => {
  it("a) 200 com corpo válido e senha_alterada_em null devolve a conta", async () => {
    authGet.mockResolvedValue(resposta(200, CONTA));

    await expect(fetchConta("u1")).resolves.toEqual(CONTA);
  });

  it("b) corpo sem termos_versao_vigente rejeita com ZodError", async () => {
    const { termos_versao_vigente: _omitido, ...sem } = CONTA;
    void _omitido;
    authGet.mockResolvedValue(resposta(200, sem));

    await expect(fetchConta("u1")).rejects.toBeInstanceOf(ZodError);
  });

  it("c) 200 com outro sub rejeita com Error que não é ContaError", async () => {
    authGet.mockResolvedValue(resposta(200, { ...CONTA, sub: "u2" }));

    await expect(fetchConta("u1")).rejects.toBeInstanceOf(Error);
    await expect(fetchConta("u1")).rejects.not.toBeInstanceOf(ContaError);
  });

  it("d) 403 com {codigo:conta_inativa} vira ContaError com status e codigo", async () => {
    authGet.mockResolvedValue(resposta(403, { codigo: "conta_inativa" }));

    const err: unknown = await fetchConta("u1").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ContaError);
    expect((err as ContaError).status).toBe(403);
    expect((err as ContaError).codigo).toBe("conta_inativa");
  });

  it("e) 403 sem corpo (json rejeita) vira ContaError sem codigo nem erros", async () => {
    authGet.mockResolvedValue(resposta(403));

    const err: unknown = await fetchConta("u1").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ContaError);
    expect((err as ContaError).status).toBe(403);
    expect((err as ContaError).codigo).toBeUndefined();
    expect((err as ContaError).erros).toBeUndefined();
  });

  it("f) 400 com erros por campo preenche ContaError.erros", async () => {
    const erros = { versao: [{ codigo: "termos_desatualizados", mensagem: "old" }] };
    authGet.mockResolvedValue(resposta(400, { erros }));

    const err: unknown = await fetchConta("u1").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ContaError);
    expect((err as ContaError).status).toBe(400);
    expect((err as ContaError).erros).toEqual(erros);
  });

  it("g) chama authGet com config.idp.api.conta", async () => {
    authGet.mockResolvedValue(resposta(200, CONTA));

    await fetchConta("u1");

    expect(authGet).toHaveBeenCalledTimes(1);
    expect(authGet).toHaveBeenCalledWith(config.idp.api.conta);
  });
});

describe("mensagemDoErro", () => {
  it("h) códigos conhecidos dão os textos da §5; desconhecido dá a mensagem do IdP", () => {
    expect(mensagemDoErro({ codigo: "max_length", mensagem: "x" })).toBe(
      "Use no máximo 150 caracteres.",
    );
    expect(mensagemDoErro({ codigo: "invalid", mensagem: "x" })).toBe("Valor inválido.");
    expect(mensagemDoErro({ codigo: "termos_desatualizados", mensagem: "x" })).toBe(
      "Os termos foram atualizados e esta página ainda não tem a versão nova. Tente mais tarde.",
    );
    expect(mensagemDoErro({ codigo: "outro", mensagem: "Texto do IdP" })).toBe("Texto do IdP");
  });
});

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

describe("useAceitarTermos", () => {
  it("a) mutate chama authSend('POST','termos',{versao:'1'})", async () => {
    const { wrapper } = setup();
    authSend.mockResolvedValue(resposta(204));
    const { result } = renderHook(() => useAceitarTermos("u1"), { wrapper });

    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(authSend).toHaveBeenCalledTimes(1);
    expect(authSend).toHaveBeenCalledWith("POST", "termos", { versao: "1" });
  });

  it("b) com 204 rebusca a conta e só termina depois da conta nova", async () => {
    const { queryClient, wrapper } = setup();
    authSend.mockResolvedValue(resposta(204));
    authGet.mockResolvedValueOnce(resposta(200, { ...CONTA, termos_versao: "" }));
    // Observadora ativa da query de produção: invalidateQueries só rebusca queries ativas.
    const { result: observa } = renderHook(() => useConta("u1"), { wrapper });
    await waitFor(() => expect(observa.current.isSuccess).toBe(true));
    authGet.mockClear();

    let liberar!: (r: Response) => void;
    authGet.mockReturnValueOnce(new Promise<Response>((res) => (liberar = res)));
    const { result } = renderHook(() => useAceitarTermos("u1"), { wrapper });

    act(() => result.current.mutate());
    await waitFor(() => expect(authGet).toHaveBeenCalledTimes(1));
    // Rebusca em curso: o 204 já chegou, mas a mutação segue pendente.
    expect(authSend).toHaveBeenCalledTimes(1);
    expect(result.current.isPending).toBe(true);
    expect(result.current.isSuccess).toBe(false);

    await act(async () => {
      liberar(resposta(200, CONTA));
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isPending).toBe(false);
    expect(queryClient.getQueryData(["conta", "u1"])).toEqual(CONTA);
  });

  it("c) 400 termos_desatualizados vira ContaError com erros e não invalida a conta", async () => {
    const { queryClient, wrapper } = setup();
    const erros = { versao: [{ codigo: "termos_desatualizados", mensagem: "old" }] };
    authSend.mockResolvedValue(resposta(400, { erros }));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAceitarTermos("u1"), { wrapper });

    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ContaError);
    expect((result.current.error as ContaError).erros).toEqual(erros);
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("useEditarConta", () => {
  const CAMPOS = { first_name: "Bia", last_name: "Souza", nickname: "bia" };

  it("d) 200 grava o corpo em ['conta',sub] e invalida ['userinfo',sub]", async () => {
    const { queryClient, wrapper } = setup();
    const nova = { ...CONTA, ...CAMPOS };
    authSend.mockResolvedValue(resposta(200, nova));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useEditarConta("u1"), { wrapper });

    act(() => result.current.mutate(CAMPOS));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(authSend).toHaveBeenCalledWith("PATCH", "conta", CAMPOS);
    expect(queryClient.getQueryData(["conta", "u1"])).toEqual(nova);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["userinfo", "u1"] });
  });

  it("e) 200 com sub divergente erra e deixa o cache intacto", async () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(["conta", "u1"], CONTA);
    authSend.mockResolvedValue(resposta(200, { ...CONTA, ...CAMPOS, sub: "u2" }));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useEditarConta("u1"), { wrapper });

    act(() => result.current.mutate(CAMPOS));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).not.toBeInstanceOf(ContaError);
    expect(queryClient.getQueryData(["conta", "u1"])).toEqual(CONTA);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("f) 400 vira ContaError com erros por campo", async () => {
    const { wrapper } = setup();
    const erros = { nickname: [{ codigo: "max_length", mensagem: "too long" }] };
    authSend.mockResolvedValue(resposta(400, { erros }));
    const { result } = renderHook(() => useEditarConta("u1"), { wrapper });

    act(() => result.current.mutate(CAMPOS));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ContaError);
    expect((result.current.error as ContaError).erros).toEqual(erros);
  });

  it("g) mutate cancela o GET em voo; o GET resolvido depois do 200 não sobrescreve o cache", async () => {
    const { queryClient, wrapper } = setup();
    const nova = { ...CONTA, ...CAMPOS };
    let liberar!: (r: Response) => void;
    authGet.mockReturnValueOnce(new Promise<Response>((res) => (liberar = res)));
    renderHook(() => useConta("u1"), { wrapper });
    await waitFor(() => expect(authGet).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryState(["conta", "u1"])?.fetchStatus).toBe("fetching");
    authSend.mockResolvedValue(resposta(200, nova));
    const { result } = renderHook(() => useEditarConta("u1"), { wrapper });

    act(() => result.current.mutate(CAMPOS));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(["conta", "u1"])).toEqual(nova);

    await act(async () => {
      liberar(resposta(200, CONTA));
    });

    expect(queryClient.getQueryState(["conta", "u1"])?.fetchStatus).toBe("idle");
    expect(queryClient.getQueryData(["conta", "u1"])).toEqual(nova);
  });
});

describe("useReenviarConfirmacao", () => {
  it("g) 204 resolve; 429 vira ContaError com status 429", async () => {
    const { wrapper } = setup();
    authSend.mockResolvedValueOnce(resposta(204));
    const { result } = renderHook(() => useReenviarConfirmacao(), { wrapper });

    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authSend).toHaveBeenCalledWith("POST", "confirmacao");

    authSend.mockResolvedValueOnce(resposta(429));
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ContaError);
    expect((result.current.error as ContaError).status).toBe(429);
  });
});
