// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Landing } from "./Landing";

const { signin, useAuth } = vi.hoisted(() => ({ signin: vi.fn(), useAuth: vi.fn() }));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => useAuth(),
}));

// "/app" real seria Area; aqui basta uma sentinela para provar navegação (ou a ausência dela)
// sem arrastar Area, useUserinfo etc. para este arquivo.
function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
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
  useAuth.mockReturnValue({ status: "anonymous", signin });
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
    useAuth.mockReturnValue({ status: "loading", signin });

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
    });

    renderLanding();

    screen.getByText("APP");
    expect(screen.queryByRole("button", { name: "Entrar" })).toBeNull();
  });
});
