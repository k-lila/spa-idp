// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Callback } from "./Callback";

const { completeSignin, navigate } = vi.hoisted(() => ({
  completeSignin: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("../auth/userManager", () => ({ completeSignin }));
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigate };
});

function renderCallback() {
  return render(
    <MemoryRouter initialEntries={["/callback"]}>
      <Callback />
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

describe("Callback", () => {
  it("completeSignin resolve: navigate(returnTo, { replace: true }) 1x", async () => {
    completeSignin.mockResolvedValue({
      claims: { sub: "u1", name: "Ana", email: "a@x" },
      returnTo: "/outra?y=2#z",
    });

    renderCallback();
    await flush();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/outra?y=2#z", { replace: true });
  });

  it("completeSignin rejeita: mostra erro + link para '/', navigate não chamado", async () => {
    completeSignin.mockRejectedValue(new Error("falhou"));

    renderCallback();
    await flush();

    screen.getByText("Não foi possível concluir a autenticação.");
    const link = screen.getByRole("link", { name: "Voltar ao início" });
    expect(link.getAttribute("href")).toBe("/");
    expect(navigate).not.toHaveBeenCalled();
  });
});
