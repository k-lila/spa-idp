// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
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

const { signin, useAuth } = vi.hoisted(() => ({ signin: vi.fn(), useAuth: vi.fn() }));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => useAuth(),
}));

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
    <QueryClientProvider client={queryClient}>
      <Area />
    </QueryClientProvider>,
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
  });
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
});
