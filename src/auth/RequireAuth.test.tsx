// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequireAuth } from "./RequireAuth";

const { signin, useAuth } = vi.hoisted(() => ({ signin: vi.fn(), useAuth: vi.fn() }));
vi.mock("./AuthContext", () => ({
  useAuth: () => useAuth(),
}));

function renderRequireAuth() {
  return render(
    <MemoryRouter initialEntries={["/app?x=1#h"]}>
      <RequireAuth>
        <div data-testid="area" />
      </RequireAuth>
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
});

afterEach(() => {
  cleanup();
});

describe("RequireAuth", () => {
  it("a) status loading: nada renderizado, signin não chamado", async () => {
    useAuth.mockReturnValue({ status: "loading", signin });

    renderRequireAuth();
    await flush();

    expect(screen.queryByTestId("area")).toBeNull();
    expect(signin).not.toHaveBeenCalled();
  });

  it("b) status anonymous na entrada: signin chamado 1x com o returnTo; nada renderizado enquanto pendente", async () => {
    signin.mockReturnValue(new Promise<void>(() => {}));
    useAuth.mockReturnValue({ status: "anonymous", signin });

    renderRequireAuth();
    await flush();

    expect(signin).toHaveBeenCalledTimes(1);
    expect(signin).toHaveBeenCalledWith("/app?x=1#h");
    expect(screen.queryByTestId("area")).toBeNull();
  });

  it("c) authenticated renderiza children; ao virar anonymous na mesma montagem, children some sem signin nem fallback (ADR 0010)", async () => {
    useAuth.mockReturnValue({ status: "authenticated", signin });

    const { rerender } = renderRequireAuth();
    await flush();

    screen.getByTestId("area");

    useAuth.mockReturnValue({ status: "anonymous", signin });
    rerender(
      <MemoryRouter initialEntries={["/app?x=1#h"]}>
        <RequireAuth>
          <div data-testid="area" />
        </RequireAuth>
      </MemoryRouter>,
    );
    await flush();

    expect(screen.queryByTestId("area")).toBeNull();
    expect(signin).not.toHaveBeenCalled();
    // Nenhum fallback: nem a mensagem de falha nem a de retorno aparecem.
    expect(screen.queryByText("Não foi possível iniciar o login.")).toBeNull();
    expect(screen.queryByText("O login não foi concluído.")).toBeNull();
  });

  it("d) signin rejeita: mostra erro + Entrar + Voltar ao início; clique em Entrar chama signin de novo", async () => {
    const error = new Error("boom");
    signin.mockRejectedValue(error);
    useAuth.mockReturnValue({ status: "anonymous", signin });

    renderRequireAuth();
    await flush();

    screen.getByText("Não foi possível iniciar o login.");
    const link = screen.getByRole("link", { name: "Voltar ao início" });
    expect(link.getAttribute("href")).toBe("/");
    expect(screen.queryByTestId("area")).toBeNull();
    expect(signin).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await flush();

    expect(signin).toHaveBeenCalledTimes(2);
  });

  it("e) signin resolve (retorno por bfcache): mostra 'O login não foi concluído.'", async () => {
    signin.mockResolvedValue(undefined);
    useAuth.mockReturnValue({ status: "anonymous", signin });

    renderRequireAuth();
    await flush();

    screen.getByText("O login não foi concluído.");
    expect(screen.queryByTestId("area")).toBeNull();
  });
});
