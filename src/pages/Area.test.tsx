// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Area } from "./Area";

// vi.hoisted: vi.mock sobe para o topo do arquivo, então as const referenciadas nas factories
// precisam subir junto para não cair em TDZ.
const { getUserInfoEndpoint } = vi.hoisted(() => ({ getUserInfoEndpoint: vi.fn() }));
vi.mock("../auth/userManager", () => ({
  userManager: { metadataService: { getUserInfoEndpoint } },
}));

const { authGet, authSend } = vi.hoisted(() => ({ authGet: vi.fn(), authSend: vi.fn() }));
vi.mock("../api/http", () => ({
  authGet,
  authSend,
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

// config.ts lança no import se faltarem VITE_*; a conta só lê config.idp.api (como em AceiteDosTermos).
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

const { signin, signout, useAuth } = vi.hoisted(() => ({
  signin: vi.fn(),
  signout: vi.fn(),
  useAuth: vi.fn(),
}));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => useAuth(),
}));

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigate };
});

const ENDPOINT = "http://idp.test/o/userinfo/";
const CONTA_URL = "http://idp.test/api/conta/";

const CONTA = {
  sub: "u1",
  email: "a@x",
  email_verified: true,
  first_name: "Ana",
  last_name: "Silva",
  nickname: "Lila",
  date_joined: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  senha_alterada_em: null,
  termos_versao: "1",
  termos_versao_vigente: "1",
};

function fakeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function renderArea(conta?: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // A guarda só abre a área com a conta em cache: aqui o cache é semeado, e o mock de authGet
  // distingue a URL da conta da do userinfo.
  if (conta !== undefined) queryClient.setQueryData(["conta", "u1"], conta);
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Area />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function sectionOf(headingName: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: headingName });
  const section = heading.closest("section");
  if (section === null) throw new Error(`seção de "${headingName}" não encontrada`);
  return section;
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserInfoEndpoint.mockResolvedValue(ENDPOINT);
  useAuth.mockReturnValue({
    status: "authenticated",
    claims: { sub: "u1", name: "Ana", email: "a@x" },
    signin,
    signout,
  });
  navigate.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("Area", () => {
  it("a) mostra id_token de imediato e 'Carregando…' enquanto userinfo está pendente", () => {
    authGet.mockReturnValue(new Promise<Response>(() => {}));

    renderArea();

    // @testing-library/jest-dom não está instalado: getByText já lança se o texto não existe,
    // então a asserção é a própria chamada (não usar toBeInTheDocument).
    const idTokenSection = sectionOf("id_token");
    within(idTokenSection).getByText("u1");
    within(idTokenSection).getByText("Ana");
    within(idTokenSection).getByText("a@x");

    screen.getByRole("heading", { name: "userinfo" });
    screen.getByText("Carregando…");
  });

  it("b) userinfo carregado mostra os dados e descarta campos fora do contrato", async () => {
    authGet.mockResolvedValue(fakeResponse({ sub: "u1", name: "", email: "a@x", extra: 1 }));

    renderArea();

    const userinfoSection = sectionOf("userinfo");
    await within(userinfoSection).findByText("u1");

    within(userinfoSection).getByText("a@x");
    expect(screen.queryByText("Carregando…")).toBeNull();
    expect(screen.queryByText(/extra/)).toBeNull();

    // AC-11: name vazio no userinfo mostra o placeholder...
    const ddName = within(userinfoSection).getByText("name").nextElementSibling;
    expect(ddName?.textContent).toBe("(sem nome)");

    // ...e o id_token (name "Ana", do beforeEach) não é afetado pelo userinfo.
    const idTokenSection = sectionOf("id_token");
    const idDdName = within(idTokenSection).getByText("name").nextElementSibling;
    expect(idDdName?.textContent).toBe("Ana");
    expect(within(idTokenSection).queryByText("(sem nome)")).toBeNull();
  });

  it("c) userinfo com sub divergente mostra erro, preserva id_token e não dispara signin", async () => {
    authGet.mockResolvedValue(fakeResponse({ sub: "u2", name: "Ana", email: "a@x" }));

    renderArea();

    await screen.findByText("Não foi possível obter o userinfo.");

    const idTokenSection = sectionOf("id_token");
    within(idTokenSection).getByText("u1");
    expect(signin).not.toHaveBeenCalled();
  });

  it("d) Sair chama signout 1x; se resolve, navigate não é chamado (quem navega é o IdP)", async () => {
    authGet.mockReturnValue(new Promise<Response>(() => {}));
    signout.mockResolvedValue(undefined);

    renderArea();

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(signout).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("d2) Sair com signout rejeitando: console.error e navigate('/', { state: { signoutFailed: true } }) 1x, sem replace", async () => {
    authGet.mockReturnValue(new Promise<Response>(() => {}));
    const err = new Error("descoberta fora");
    signout.mockRejectedValue(err);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    renderArea();

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(signout).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(err);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/", { state: { signoutFailed: true } });
    consoleError.mockRestore();
  });

  it("e) sem o aviso antigo sobre o alcance do Sair; o botão Sair segue presente", () => {
    authGet.mockReturnValue(new Promise<Response>(() => {}));

    renderArea();

    expect(screen.queryByText(/Sair só esquece a sessão nesta aplicação/)).toBeNull();
    screen.getByRole("button", { name: "Sair" });
  });

  it("f) claims com name vazio mostra o placeholder no id_token mesmo com userinfo pendente (AC-10)", () => {
    useAuth.mockReturnValue({
      status: "authenticated",
      claims: { sub: "u1", name: "", email: "a@x" },
      signin,
      signout,
    });
    authGet.mockReturnValue(new Promise<Response>(() => {}));

    renderArea();

    const idTokenSection = sectionOf("id_token");
    const ddName = within(idTokenSection).getByText("name").nextElementSibling;
    expect(ddName?.textContent).toBe("(sem nome)");
    within(idTokenSection).getByText("u1");
    within(idTokenSection).getByText("a@x");
  });

  it("g) userinfo resolvido sem name vazio não mostra placeholder em nenhuma seção (AC-12)", async () => {
    authGet.mockResolvedValue(fakeResponse({ sub: "u1", name: "Ana", email: "a@x" }));

    renderArea();

    const userinfoSection = sectionOf("userinfo");
    await within(userinfoSection).findByText("u1");

    const idTokenSection = sectionOf("id_token");
    within(idTokenSection).getByText("Ana");
    within(userinfoSection).getByText("Ana");
    expect(screen.queryByText("(sem nome)")).toBeNull();
  });
  describe("com a conta em cache", () => {
    beforeEach(() => {
      authGet.mockImplementation((url: string) =>
        Promise.resolve(
          url === CONTA_URL
            ? fakeResponse(CONTA)
            : fakeResponse({ sub: "u1", name: "Ana", email: "a@x" }),
        ),
      );
    });

    it.each([
      ["apelido", { nickname: "Lila", first_name: "Ana" }, "Olá, Lila!"],
      ["nome, sem apelido", { nickname: "", first_name: "Ana" }, "Olá, Ana!"],
      ["e-mail, sem apelido nem nome", { nickname: "", first_name: "" }, "Olá, a@x!"],
    ])("T-01) saudação pelo %s", async (_, campos, texto) => {
      renderArea({ ...CONTA, ...campos });

      const saudacao = await screen.findByText(texto);
      expect(saudacao.textContent).toBe(texto);
      expect(saudacao.closest("section")).toBeNull();
    });

    it("T-01) link Minha conta fora das seções e id_token/userinfo com 3 dd cada", async () => {
      renderArea(CONTA);

      const link = await screen.findByRole("link", { name: "Minha conta" });
      expect(link.getAttribute("href")).toBe("/app/conta");
      expect(link.closest("section")).toBeNull();

      const userinfo = sectionOf("userinfo");
      await waitFor(() => expect(userinfo.querySelectorAll("dd")).toHaveLength(3));
      expect(sectionOf("id_token").querySelectorAll("dd")).toHaveLength(3);
      // A faixa não existe com e-mail confirmado; quando existe, também fica fora das seções.
      expect(screen.queryByText("Confirme seu e-mail")).toBeNull();
    });

    it("T-01) a faixa de confirmação fica fora de qualquer seção", async () => {
      renderArea({ ...CONTA, email_verified: false });

      const faixa = await screen.findByText("Confirme seu e-mail");
      expect(faixa.closest("section")).toBeNull();
      expect(screen.getByRole("button", { name: "Reenviar" }).closest("section")).toBeNull();
    });

    it("T-02) com e-mail confirmado não há faixa nem Reenviar", async () => {
      renderArea(CONTA);

      await screen.findByText("Olá, Lila!");
      expect(screen.queryByText("Confirme seu e-mail")).toBeNull();
      expect(screen.queryByRole("button", { name: "Reenviar" })).toBeNull();
    });

    it("T-02) 204: Reenviar chama authSend('POST','confirmacao') e mostra a confirmação", async () => {
      authSend.mockResolvedValue(fakeResponse(undefined, 204));
      renderArea({ ...CONTA, email_verified: false });

      fireEvent.click(await screen.findByRole("button", { name: "Reenviar" }));

      await screen.findByText("Se o e-mail ainda não foi confirmado, enviamos um novo link.");
      expect(authSend).toHaveBeenCalledTimes(1);
      expect(authSend).toHaveBeenCalledWith("POST", "confirmacao");
    });

    it("T-02) 429: mensagem de muitas tentativas em role=alert", async () => {
      authSend.mockResolvedValue(fakeResponse(undefined, 429));
      renderArea({ ...CONTA, email_verified: false });

      fireEvent.click(await screen.findByRole("button", { name: "Reenviar" }));

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Muitas tentativas. Tente de novo em instantes.",
      );
      expect(screen.queryByText(/enviamos um novo link/)).toBeNull();
    });

    it("T-02) 500: 'Não foi possível reenviar.' em role=alert", async () => {
      authSend.mockResolvedValue(fakeResponse(undefined, 500));
      renderArea({ ...CONTA, email_verified: false });

      fireEvent.click(await screen.findByRole("button", { name: "Reenviar" }));

      expect((await screen.findByRole("alert")).textContent).toBe("Não foi possível reenviar.");
    });

    it("T-02) durante o envio o botão fica desabilitado", async () => {
      let liberar!: (r: Response) => void;
      authSend.mockImplementation(() => new Promise<Response>((res) => (liberar = res)));
      renderArea({ ...CONTA, email_verified: false });

      fireEvent.click(await screen.findByRole("button", { name: "Reenviar" }));

      await waitFor(() =>
        expect(screen.getByRole<HTMLButtonElement>("button", { name: "Reenviar" }).disabled).toBe(
          true,
        ),
      );
      liberar(fakeResponse(undefined, 204));
      await screen.findByText("Se o e-mail ainda não foi confirmado, enviamos um novo link.");
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Reenviar" }).disabled).toBe(
        false,
      );
    });
  });
});
