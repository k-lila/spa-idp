// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MemoryRouter,
  RouterProvider,
  Route,
  Routes,
  createMemoryRouter,
  type InitialEntry,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../config";
import { Landing } from "./Landing";

// T-03 lê o config real: o stub roda antes dos imports (vi.hoisted) e imita o .env.example.
const { signin, signup, useAuth } = vi.hoisted(() => {
  vi.stubEnv("VITE_OIDC_ISSUER", "http://localhost:9000/o");
  vi.stubEnv("VITE_OIDC_CLIENT_ID", "spa-local");
  vi.stubEnv("VITE_OIDC_REDIRECT_URI", "http://localhost:5173/callback");
  vi.stubEnv("VITE_OIDC_POST_LOGOUT_REDIRECT_URI", "http://localhost:5173/");
  return { signin: vi.fn(), signup: vi.fn(), useAuth: vi.fn() };
});
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => useAuth(),
}));

// "/app" real seria Area; aqui basta uma sentinela para provar navegação (ou a ausência dela)
// sem arrastar Area, useUserinfo etc. para este arquivo.
function renderLanding(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/", state }]}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<p>APP</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ status: "anonymous", signin, signup });
});

afterEach(() => {
  cleanup();
});

describe("Landing", () => {
  it("signin rejeita: mostra alerta; segundo clique remove o alerta no ato e chama signin 2x", async () => {
    signin.mockRejectedValue(new Error("boom"));

    renderLanding();

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await flush();

    screen.getByRole("alert");
    screen.getByText("Não foi possível iniciar o login.");
    screen.getByRole("button", { name: "Entrar" });

    let resolveSecond: (() => void) | undefined;
    signin.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSecond = resolve;
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(signin).toHaveBeenCalledTimes(2);

    resolveSecond?.();
    await flush();
  });

  it("signin resolve: nenhum alerta aparece", async () => {
    signin.mockResolvedValue(undefined);

    renderLanding();

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await flush();

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("status loading: nada renderiza, sem navegação, signin não chamado (AC-01)", () => {
    useAuth.mockReturnValue({ status: "loading", signin, signup });

    const { container } = renderLanding();

    expect(screen.queryByRole("button", { name: "Entrar" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("APP")).toBeNull();
    expect(signin).not.toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
  });

  it("status authenticated: navega para /app, sem botão Entrar (AC-03)", () => {
    useAuth.mockReturnValue({
      status: "authenticated",
      claims: { sub: "u1", name: "Ana", email: "a@x" },
      signin,
      signup,
    });

    renderLanding();

    screen.getByText("APP");
    expect(screen.queryByRole("button", { name: "Entrar" })).toBeNull();
  });

  // Só `signoutFailed === true` (booleano) liga o alerta do Sair que falhou (ADR 0019).
  const SIGNOUT_ALERT = "Não foi possível encerrar a sessão no provedor de identidade.";

  it("state { signoutFailed: true }: alerta do logout e botão Entrar", () => {
    renderLanding({ signoutFailed: true });

    screen.getByRole("alert");
    screen.getByText(SIGNOUT_ALERT);
    screen.getByRole("button", { name: "Entrar" });
  });

  it.each([
    ["sem state", undefined],
    ['{ signoutFailed: "true" } (string)', { signoutFailed: "true" }],
    ["state null", null],
  ])("%s: alerta do logout não aparece", (_nome, state) => {
    renderLanding(state);

    expect(screen.queryByText(SIGNOUT_ALERT)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    screen.getByRole("button", { name: "Entrar" });
  });

  it("signoutFailed e signin rejeitando: os dois alertas convivem", async () => {
    signin.mockRejectedValue(new Error("boom"));

    renderLanding({ signoutFailed: true });

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await flush();

    expect(screen.getAllByRole("alert")).toHaveLength(2);
    screen.getByText(SIGNOUT_ALERT);
    screen.getByText("Não foi possível iniciar o login.");
  });

  it("T-01) Criar conta chama signup, não signin; sem alerta e com a nota visível", async () => {
    signup.mockResolvedValue(undefined);

    renderLanding();

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    await flush();

    expect(signup).toHaveBeenCalledTimes(1);
    expect(signin).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    screen.getByText(
      'Com uma sessão já aberta no provedor de identidade, "Criar conta" entra na conta existente.',
    );
  });

  describe("falhas do cadastro", () => {
    const FALHA_CADASTRO = "Não foi possível iniciar o cadastro.";
    const FALHA_LOGIN = "Não foi possível iniciar o login.";
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterEach(() => {
      consoleError.mockRestore();
    });

    it("T-02a) signup rejeita: alerta do cadastro e console.error com o erro", async () => {
      const erro = new Error("boom");
      signup.mockRejectedValue(erro);

      renderLanding();
      fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

      const alerta = await screen.findByRole("alert");
      expect(alerta.textContent).toBe(FALHA_CADASTRO);
      expect(consoleError).toHaveBeenCalledWith(erro);
    });

    it("T-02b) novo clique com promessa pendente: o alerta some no ato e signup roda 2x", async () => {
      signup.mockRejectedValueOnce(new Error("boom"));
      renderLanding();
      fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
      await screen.findByRole("alert");

      let resolver: (() => void) | undefined;
      signup.mockReturnValue(
        new Promise<void>((resolve) => {
          resolver = resolve;
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(screen.queryByRole("alert")).toBeNull();
      expect(signup).toHaveBeenCalledTimes(2);

      resolver?.();
      await flush();
    });

    it("T-02c) Entrar rejeita e depois Criar conta rejeita: um único alerta, o do cadastro", async () => {
      signin.mockRejectedValue(new Error("login"));
      signup.mockRejectedValue(new Error("cadastro"));
      renderLanding();

      fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
      await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(FALHA_LOGIN));

      fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
      await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(FALHA_CADASTRO));

      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(screen.queryByText(FALHA_LOGIN)).toBeNull();
    });
  });

  it("T-03) Esqueci a senha aponta à origem do issuer; sem campo de senha; botões type=button", () => {
    const { container } = renderLanding();

    const href = screen.getByRole("link", { name: "Esqueci a senha" }).getAttribute("href");
    expect(href).toBe(config.idp.paginas.recuperarSenha);
    expect(new URL(href ?? "").origin).toBe(new URL(config.oidc.issuer).origin);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    for (const nome of ["Entrar", "Criar conta"]) {
      expect(screen.getByRole("button", { name: nome }).getAttribute("type")).toBe("button");
    }
  });
});

// Avisos das voltas do IdP (contrato §11.3): lidos uma vez e retirados da URL com replace.
describe("Landing: avisos na URL", () => {
  function montar(entrada: InitialEntry = "/", rotas = true) {
    const router = createMemoryRouter(
      [
        { path: "/", element: <Landing /> },
        ...(rotas ? [{ path: "/app", element: <p>APP</p> }] : []),
      ],
      { initialEntries: [entrada] },
    );
    const resultado = render(<RouterProvider router={router} />);
    return { router, ...resultado };
  }

  it.each([
    ["?email=confirmado", "E-mail confirmado. Entre para continuar."],
    ["?email=invalido", "O link de confirmação não vale mais. Entre e peça outro."],
    ["?conta=desativada", "Conta desativada. Para reativá-la, fale com quem administra."],
    ["?conta=apagada", "Conta apagada."],
  ])(
    "T-04) %s: mostra o aviso, limpa a URL com REPLACE e o aviso permanece",
    async (query, texto) => {
      const { router } = montar(`/${query}`);

      const status = await screen.findByRole("status");
      expect(status.textContent).toBe(texto);
      await waitFor(() => expect(router.state.location.search).toBe(""));
      expect(router.state.historyAction).toBe("REPLACE");
      expect(screen.getByRole("status").textContent).toBe(texto);
    },
  );

  it("T-05) dois avisos em ordem; só email e conta saem; hash e state preservados", async () => {
    const { router } = montar({
      pathname: "/",
      search: "?x=1&email=confirmado&conta=apagada",
      hash: "#h",
      state: { signoutFailed: true },
    });

    await waitFor(() => expect(screen.getAllByRole("status")).toHaveLength(2));
    expect(screen.getAllByRole("status").map((el) => el.textContent)).toEqual([
      "E-mail confirmado. Entre para continuar.",
      "Conta apagada.",
    ]);
    await waitFor(() => expect(router.state.location.search).toBe("?x=1"));
    expect(router.state.location.hash).toBe("#h");
    expect(router.state.location.state).toEqual({ signoutFailed: true });
    screen.getByText("Não foi possível encerrar a sessão no provedor de identidade.");
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it.each([
    "?email=constructor",
    "?conta=__proto__",
    "?email=Confirmado",
    "?email=",
    "?conta=desativado",
  ])("T-06) %s: nenhum status e o parâmetro sai da URL", async (query) => {
    const { router } = montar(`/${query}`);

    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(screen.queryByRole("status")).toBeNull();
    screen.getByRole("button", { name: "Entrar" });
  });

  it("T-06) parâmetro estranho (?foo=confirmado): sem status, URL intacta, sem navegação", async () => {
    const { router } = montar("/?foo=confirmado");

    await screen.findByRole("button", { name: "Entrar" });
    await flush();
    expect(screen.queryByRole("status")).toBeNull();
    expect(router.state.location.search).toBe("?foo=confirmado");
    expect(router.state.historyAction).toBe("POP");
  });

  it("T-07) loading limpa a URL sem renderizar; ao virar anonymous mostra o aviso lido na montagem", async () => {
    useAuth.mockReturnValue({ status: "loading", signin, signup });
    const { router, container } = montar("/?email=invalido");

    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(container.firstChild).toBeNull();

    useAuth.mockReturnValue({ status: "anonymous", signin, signup });
    // Mesma instância do router: uma navegação à mesma rota força o Landing montado a re-renderizar.
    await act(() => router.navigate("/", { replace: true }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toBe("O link de confirmação não vale mais. Entre e peça outro.");
  });

  it("T-10) authenticated em /?conta=apagada: vai a /app e a limpeza não desfaz a navegação", async () => {
    useAuth.mockReturnValue({
      status: "authenticated",
      claims: { sub: "u1", name: "Ana", email: "a@x" },
      signin,
      signup,
    });
    const { router } = montar("/?conta=apagada");

    await screen.findByText("APP");
    await flush();
    expect(router.state.location.pathname).toBe("/app");
    expect(screen.getByText("APP")).toBeTruthy();
  });
});
