// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import type { User } from "oidc-client-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "./AuthContext";
import { AuthProvider } from "./AuthProvider";

let userLoadedHandler: ((user: User) => void) | undefined;
const restoreSession = vi.fn();
const addUserLoaded = vi.fn((handler: (user: User) => void) => {
  userLoadedHandler = handler;
  return vi.fn(); // unsubscribe
});

vi.mock("./userManager", () => ({
  userManager: {
    events: { addUserLoaded: (handler: (user: User) => void) => addUserLoaded(handler) },
  },
  restoreSession: () => restoreSession(),
  signin: vi.fn(),
}));

function asUser(profile: unknown): User {
  return { profile } as User;
}

// Sonda: lê useAuth() e expõe status + chaves de claims (sem export do estado interno).
function Probe() {
  const auth = useAuth();
  const claimsKeys = auth.status === "authenticated" ? Object.keys(auth.claims).join(",") : "";
  return <div data-testid="probe" data-status={auth.status} data-claims-keys={claimsKeys} />;
}

function renderProbe() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  userLoadedHandler = undefined;
  restoreSession.mockReset().mockResolvedValue(null);
  addUserLoaded.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  it("userLoaded com profile inválido mantém o contexto anonymous", async () => {
    renderProbe();
    await act(async () => {
      await Promise.resolve();
    });

    expect(userLoadedHandler).toBeDefined();
    act(() => {
      userLoadedHandler?.(asUser({ sub: "u1" })); // falta name/email
    });

    const probe = screen.getByTestId("probe");
    expect(probe.dataset.status).toBe("anonymous");
  });

  it("userLoaded com profile válido leva a authenticated com claims sem chaves extras", async () => {
    renderProbe();
    await act(async () => {
      await Promise.resolve();
    });

    expect(userLoadedHandler).toBeDefined();
    act(() => {
      userLoadedHandler?.(
        asUser({ sub: "u1", name: "Ana", email: "ana@example.com", iat: 1, sid: "s" }),
      );
    });

    const probe = screen.getByTestId("probe");
    expect(probe.dataset.status).toBe("authenticated");
    expect(probe.dataset.claimsKeys).toBe("sub,name,email");
  });

  it("restoreSession resolvendo user com profile inválido leva a anonymous", async () => {
    restoreSession.mockResolvedValue(asUser({ sub: "u1" })); // falta name/email

    renderProbe();
    await act(async () => {
      await Promise.resolve();
    });

    const probe = screen.getByTestId("probe");
    expect(probe.dataset.status).toBe("anonymous");
  });
});
