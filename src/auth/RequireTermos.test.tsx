// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authGet, getUserInfoEndpoint, signin, signout, useAuth } = vi.hoisted(() => ({
  authGet: vi.fn(),
  getUserInfoEndpoint: vi.fn(),
  signin: vi.fn(),
  signout: vi.fn(),
  useAuth: vi.fn(),
}));
vi.mock("./AuthContext", () => ({ useAuth: () => useAuth() }));
vi.mock("../api/http", () => ({
  authGet,
  authSend: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
// Area e Conta reais (T-03, T-13): o userinfo descobre o endpoint pelo userManager.
vi.mock("../auth/userManager", () => ({
  userManager: { metadataService: { getUserInfoEndpoint } },
}));
// config.ts lança no import se faltarem VITE_*; conta.ts só lê config.idp.api (como em http.test.ts).
vi.mock("../config", () => ({
  config: {
    idp: {
      api: {
        conta: "http://idp.test/api/conta/",
        confirmacao: "http://idp.test/api/conta/confirmacao/",
        termos: "http://idp.test/api/conta/termos/",
      },
      paginas: {
        trocarSenha: "http://idp.test/accounts/password_change/",
        trocarEmail: "http://idp.test/accounts/email/",
        excluir: "http://idp.test/accounts/excluir/",
      },
    },
  },
}));

import { Area as AreaReal } from "../pages/Area";
import { Conta as ContaReal } from "../pages/Conta";
import { RequireTermos } from "./RequireTermos";

const ACEITA = {
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
const SEM_ACEITE = { ...ACEITA, termos_versao: "" };

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

const CHAMADA_DO_FILHO = "chamada-do-filho";

// Filho que faz uma chamada autenticada própria ao montar: prova que a área não monta antes da conta.
function Area() {
  useEffect(() => {
    void authGet(CHAMADA_DO_FILHO);
  }, []);
  return <div>AREA</div>;
}

function montar(entrada: string | { pathname: string; state?: unknown }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: "/app",
        element: (
          <RequireTermos>
            <Outlet />
          </RequireTermos>
        ),
        children: [
          { index: true, element: <Area /> },
          { path: "termos", element: <div>ACEITE</div> },
          { path: "x", element: <div>X</div> },
        ],
      },
      { path: "/", element: <div>FORA</div> },
    ],
    { initialEntries: [entrada] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

// Afirmação positiva espera por findBy*/waitFor (folga para a suíte em carga); o flush fixo só
// serve para provar ausência. O react-query notifica por setTimeout: é preciso uma macrotarefa.
configure({ asyncUtilTimeout: 4000 });

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const CONTA_URL = "http://idp.test/api/conta/";
const USERINFO_URL = "http://idp.test/o/userinfo/";

// Layout real de /app (guarda > Outlet) com as telas reais; authGet responde por URL.
function montarReal(conta: () => object) {
  authGet.mockImplementation((url: string) =>
    Promise.resolve(
      url === CONTA_URL
        ? resposta(200, conta())
        : resposta(200, { sub: "u1", name: "Ana", email: "a@x.com" }),
    ),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: "/app",
        element: (
          <RequireTermos>
            <Outlet />
          </RequireTermos>
        ),
        children: [
          { index: true, element: <AreaReal /> },
          { path: "conta", element: <ContaReal /> },
        ],
      },
    ],
    { initialEntries: ["/app"] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

function contaChamadas() {
  return authGet.mock.calls.filter(([url]) => url === "http://idp.test/api/conta/").length;
}

beforeEach(() => {
  vi.resetAllMocks();
  getUserInfoEndpoint.mockResolvedValue(USERINFO_URL);
  useAuth.mockReturnValue({
    status: "authenticated",
    claims: { sub: "u1" },
    signin,
    signout,
  });
  authGet.mockImplementation(() => Promise.resolve(resposta(200, ACEITA)));
});

afterEach(() => {
  cleanup();
});

describe("RequireTermos", () => {
  it("a) GET pendente: nada renderizado e o filho não monta nem chama authGet antes da conta", async () => {
    let liberar!: (r: Response) => void;
    authGet.mockImplementation(() => new Promise<Response>((res) => (liberar = res)));

    montar("/app");
    await flush();

    expect(screen.queryByText("AREA")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(authGet).toHaveBeenCalledTimes(1);
    expect(authGet).toHaveBeenCalledWith("http://idp.test/api/conta/");
    expect(authGet).not.toHaveBeenCalledWith(CHAMADA_DO_FILHO);

    authGet.mockImplementation(() => Promise.resolve(resposta(200, ACEITA)));
    await act(async () => {
      liberar(resposta(200, ACEITA));
    });

    await screen.findByText("AREA");
    expect(authGet).toHaveBeenCalledWith(CHAMADA_DO_FILHO);
  });

  it("b) GET falha: alerta, Tentar de novo e Sair; Tentar de novo busca de novo", async () => {
    authGet.mockImplementation(() => Promise.resolve(resposta(500)));

    montar("/app");

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toBe("Não foi possível carregar a sua conta.");
    screen.getByRole("button", { name: "Sair" });
    expect(screen.queryByText("AREA")).toBeNull();
    expect(contaChamadas()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await waitFor(() => expect(contaChamadas()).toBe(2));
  });

  it("c) conta aceita em cache e nova busca que falha: a área some e aparece a tela de falha", async () => {
    const { queryClient } = montar("/app");
    await screen.findByText("AREA");

    authGet.mockImplementation(() => Promise.resolve(resposta(500)));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["conta", "u1"] });
    });

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toBe("Não foi possível carregar a sua conta.");
    expect(screen.queryByText("AREA")).toBeNull();
  });

  it("d) 403 conta_inativa: mensagem de conta desativada, Sair, sem Tentar de novo", async () => {
    authGet.mockImplementation(() => Promise.resolve(resposta(403, { codigo: "conta_inativa" })));

    montar("/app");

    expect((await screen.findByRole("alert")).textContent).toBe("Esta conta está desativada.");
    screen.getByRole("button", { name: "Sair" });
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
  });

  it("T-12) 429 na guarda: mensagem de muitas tentativas, Tentar de novo e Sair", async () => {
    authGet.mockImplementation(() => Promise.resolve(resposta(429)));

    montar("/app");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Muitas tentativas. Tente de novo em instantes.",
    );
    screen.getByRole("button", { name: "Tentar de novo" });
    screen.getByRole("button", { name: "Sair" });
    expect(screen.queryByText("AREA")).toBeNull();
  });

  it("e) termos não aceitos em /app/x?q=1#h: vai a /app/termos com state.from e REPLACE", async () => {
    authGet.mockImplementation(() => Promise.resolve(resposta(200, SEM_ACEITE)));

    const { router } = montar("/app/x?q=1#h");
    await screen.findByText("ACEITE");

    expect(router.state.location.pathname).toBe("/app/termos");
    expect((router.state.location.state as { from: string }).from).toBe("/app/x?q=1#h");
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("f) termos não aceitos, entrada direta em /app/termos: renderiza ACEITE sem redirecionar", async () => {
    authGet.mockImplementation(() => Promise.resolve(resposta(200, SEM_ACEITE)));

    const { router } = montar("/app/termos");
    await screen.findByText("ACEITE");

    expect(router.state.location.pathname).toBe("/app/termos");
    expect(router.state.historyAction).toBe("POP");
  });

  it("g) termos aceitos em /app/termos com state.from '/app/x?q=1': vai a ele com REPLACE", async () => {
    const { router } = montar({ pathname: "/app/termos", state: { from: "/app/x?q=1" } });
    await screen.findByText("X");

    expect(router.state.location.pathname).toBe("/app/x");
    expect(router.state.location.search).toBe("?q=1");
    expect(router.state.historyAction).toBe("REPLACE");
  });

  const DESTINOS_INVALIDOS: [string, unknown][] = [
    ["//evil.example", { from: "//evil.example" }],
    ["https://evil.example/app", { from: "https://evil.example/app" }],
    ["numérico 42", { from: 42 }],
    ["sem state", undefined],
    ["/application", { from: "/application" }],
    ["/app-x", { from: "/app-x" }],
    ["/appfoo", { from: "/appfoo" }],
  ];

  it.each(DESTINOS_INVALIDOS)(
    "h) termos aceitos, from inválido (%s): vai a /app",
    async (_, state) => {
      const { router } = montar({ pathname: "/app/termos", state });
      await screen.findByText("AREA");

      expect(router.state.location.pathname).toBe("/app");
      expect(router.state.location.search).toBe("");
      expect(router.state.location.hash).toBe("");
      expect(router.state.historyAction).toBe("REPLACE");
    },
  );

  it.each([
    ["/app", "/app", "", ""],
    ["/app?x", "/app", "?x", ""],
    ["/app#y", "/app", "", "#y"],
  ])("h) termos aceitos, from '%s' é aceito", async (from, pathname, search, hash) => {
    const { router } = montar({ pathname: "/app/termos", state: { from } });
    await waitFor(() => expect(router.state.location.pathname).toBe(pathname));

    expect(router.state.location.pathname).toBe(pathname);
    expect(router.state.location.search).toBe(search);
    expect(router.state.location.hash).toBe(hash);
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("i) sub divergente: tela de falha genérica e signin nunca chamado", async () => {
    authGet.mockImplementation(() => Promise.resolve(resposta(200, { ...ACEITA, sub: "u2" })));

    montar("/app");

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toBe("Não foi possível carregar a sua conta.");
    expect(screen.queryByText("AREA")).toBeNull();
    expect(signin).not.toHaveBeenCalled();
  });
});

describe("RequireTermos > Area e Conta reais", () => {
  it("T-03) a faixa some quando o foco refaz o GET e a conta passa a ter e-mail confirmado", async () => {
    let conta: object = { ...ACEITA, email_verified: false };
    montarReal(() => conta);

    await screen.findByText("Confirme seu e-mail");
    screen.getByRole("heading", { name: "Área autenticada" });
    expect(contaChamadas()).toBe(1);

    conta = { ...ACEITA, email_verified: true };
    // O focusManager do TanStack escuta visibilitychange em window.
    act(() => {
      window.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(screen.queryByText("Confirme seu e-mail")).toBeNull());
    screen.getByRole("heading", { name: "Área autenticada" });
    expect(contaChamadas()).toBe(2);
  });

  it("T-13) só a guarda busca a conta ao montar: ir a /app/conta e voltar a /app mantém 1 GET", async () => {
    const router = montarReal(() => ACEITA);

    await screen.findByRole("heading", { name: "Área autenticada" });
    await flush();
    expect(contaChamadas()).toBe(1);

    await act(async () => {
      await router.navigate("/app/conta");
    });
    await screen.findByRole("heading", { name: "Minha conta" });
    await flush();
    expect(contaChamadas()).toBe(1);

    await act(async () => {
      await router.navigate("/app");
    });
    await screen.findByRole("heading", { name: "Área autenticada" });
    await flush();
    expect(contaChamadas()).toBe(1);
  });
});
