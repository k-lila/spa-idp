// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Landing } from "./Landing";

const { signin, useAuth } = vi.hoisted(() => ({ signin: vi.fn(), useAuth: vi.fn() }));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => useAuth(),
}));

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
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
});
