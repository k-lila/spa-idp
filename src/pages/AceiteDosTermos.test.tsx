// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authSend, signout, useAuth } = vi.hoisted(() => ({
  authSend: vi.fn(),
  signout: vi.fn(),
  useAuth: vi.fn(),
}));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => useAuth() }));
vi.mock("../api/http", () => ({ authGet: vi.fn(), authSend }));
// config.ts lança no import se faltarem VITE_*; conta.ts só lê config.idp.api (como em http.test.ts).
vi.mock("../config", () => ({
  config: {
    idp: {
      api: {
        conta: "http://idp.test/api/conta/",
        confirmacao: "http://idp.test/api/conta/confirmacao/",
        termos: "http://idp.test/api/conta/termos/",
      },
      paginas: { excluir: "http://idp.test/accounts/excluir/" },
    },
  },
}));

import { AceiteDosTermos } from "./AceiteDosTermos";

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

function novoQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

// Router de verdade (sem mockar useNavigate): permite provar para onde a localização vai.
function montarRoteado() {
  const router = createMemoryRouter(
    [
      { path: "/app/termos", element: <AceiteDosTermos /> },
      { path: "/app", element: <div>AREA</div> },
    ],
    { initialEntries: ["/app/termos"] },
  );
  render(
    <QueryClientProvider client={novoQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

function montar() {
  const queryClient = novoQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AceiteDosTermos />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// O react-query notifica por setTimeout: microtarefas não bastam, é preciso uma macrotarefa.
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function marcarEAceitar() {
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  useAuth.mockReturnValue({ status: "authenticated", claims: { sub: "u1" }, signout });
});

afterEach(() => {
  cleanup();
});

describe("AceiteDosTermos", () => {
  it("a) Aceitar fica desabilitado sem a caixa e habilitado com ela", () => {
    montar();
    const botao = screen.getByRole<HTMLButtonElement>("button", { name: "Aceitar" });

    expect(botao.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(botao.disabled).toBe(false);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(botao.disabled).toBe(true);
  });

  it("b) a caixa cita a versão 1 e há links para /termos e /privacidade", () => {
    montar();

    expect(screen.getByRole("checkbox").closest("label")?.textContent).toContain("(versão 1)");
    expect(screen.getByRole("link", { name: "termos de uso" }).getAttribute("href")).toBe(
      "/termos",
    );
    expect(screen.getByRole("link", { name: "política de privacidade" }).getAttribute("href")).toBe(
      "/privacidade",
    );
  });

  it("c) Aceitar chama authSend uma vez e o botão fica desabilitado enquanto pendente", async () => {
    authSend.mockImplementation(() => new Promise<Response>(() => {}));
    montar();

    marcarEAceitar();
    await flush();

    expect(authSend).toHaveBeenCalledTimes(1);
    expect(authSend).toHaveBeenCalledWith("POST", "termos", { versao: "1" });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Aceitar" }).disabled).toBe(true);
  });

  it("d) 400 termos_desatualizados mostra o texto da §5 em role=alert", async () => {
    const erros = { versao: [{ codigo: "termos_desatualizados", mensagem: "old" }] };
    authSend.mockResolvedValue(resposta(400, { erros }));
    montar();

    marcarEAceitar();
    await flush();

    expect(screen.getByRole("alert").textContent).toBe(
      "Os termos foram atualizados e esta página ainda não tem a versão nova. Tente mais tarde.",
    );
  });

  it("e) 429 mostra a mensagem de muitas tentativas", async () => {
    authSend.mockResolvedValue(resposta(429));
    montar();

    marcarEAceitar();
    await flush();

    expect(screen.getByRole("alert").textContent).toBe(
      "Muitas tentativas. Tente de novo em instantes.",
    );
  });

  it.each([
    ["403 sem corpo", resposta(403)],
    ["500", resposta(500)],
  ])("f) %s mostra a mensagem genérica", async (_, res) => {
    authSend.mockResolvedValue(res);
    montar();

    marcarEAceitar();
    await flush();

    expect(screen.getByRole("alert").textContent).toBe("Não foi possível registrar o aceite.");
  });

  it("g) 204 no aceite: a localização continua em /app/termos", async () => {
    authSend.mockResolvedValue(resposta(204));
    const router = montarRoteado();

    marcarEAceitar();
    await waitFor(() => expect(authSend).toHaveBeenCalledTimes(1));
    await flush();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(router.state.location.pathname).toBe("/app/termos");
    screen.getByRole("heading", { name: "Termos de uso" });
    expect(screen.queryByText("AREA")).toBeNull();
  });

  it("h) o botão Sair está presente", () => {
    montar();

    screen.getByRole("button", { name: "Sair" });
  });

  it("T-11) Excluir conta é um <a> com o href da página do IdP e clicar não muda a localização", () => {
    const router = montarRoteado();

    const link = screen.getByRole("link", { name: "Excluir conta" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("http://idp.test/accounts/excluir/");
    expect(link.hasAttribute("data-discover")).toBe(false);

    // jsdom não navega; o clique cancelado evita o "not implemented: navigation".
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(link);

    expect(router.state.location.pathname).toBe("/app/termos");
    expect(router.state.historyAction).toBe("POP");
  });
});
