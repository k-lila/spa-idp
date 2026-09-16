// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Area } from "./Area";

// vi.hoisted: vi.mock sobe para o topo do arquivo, então as const referenciadas nas factories
// precisam subir junto para não cair em TDZ.
const { getUserInfoEndpoint } = vi.hoisted(() => ({ getUserInfoEndpoint: vi.fn() }));
vi.mock("../auth/userManager", () => ({
  userManager: { metadataService: { getUserInfoEndpoint } },
}));

const { authGet } = vi.hoisted(() => ({ authGet: vi.fn() }));
vi.mock("../api/http", () => ({
  authGet,
  UnauthorizedError: class UnauthorizedError extends Error {},
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

function fakeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function renderArea() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

    const ddName = within(userinfoSection).getByText("name").nextElementSibling;
    expect(ddName?.textContent).toBe("");
  });

  it("c) userinfo com sub divergente mostra erro, preserva id_token e não dispara signin", async () => {
    authGet.mockResolvedValue(fakeResponse({ sub: "u2", name: "Ana", email: "a@x" }));

    renderArea();

    await screen.findByText("Não foi possível obter o userinfo.");

    const idTokenSection = sectionOf("id_token");
    within(idTokenSection).getByText("u1");
    expect(signin).not.toHaveBeenCalled();
  });

  it("d) Sair: navigate('/') só depois de signout resolver, sem { replace: true }", async () => {
    authGet.mockReturnValue(new Promise<Response>(() => {}));
    // Deferida por macrotask (setTimeout), como em userManager.test.ts (a): se navigate() for
    // chamado no mesmo tick do clique (sem esperar a promessa), a asserção síncrona abaixo cai.
    signout.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        }),
    );

    renderArea();

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(signout).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("e) mostra o aviso AC-04 sobre o alcance do Sair", () => {
    authGet.mockReturnValue(new Promise<Response>(() => {}));

    renderArea();

    screen.getByText(
      "Sair só esquece a sessão nesta aplicação. A sessão no provedor de identidade continua ativa: um novo Entrar pode acontecer sem pedir senha.",
    );
  });
});
