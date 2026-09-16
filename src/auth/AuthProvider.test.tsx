// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { User } from "oidc-client-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "./AuthContext";
import { AuthProvider } from "./AuthProvider";

let userLoadedHandler: ((user: User) => void) | undefined;
let userUnloadedHandler: (() => void) | undefined;
const restoreSession = vi.fn();
const unsubscribeLoaded = vi.fn();
const addUserLoaded = vi.fn((handler: (user: User) => void) => {
  userLoadedHandler = handler;
  return unsubscribeLoaded;
});
const unsubscribeUnloaded = vi.fn();
const addUserUnloaded = vi.fn((handler: () => void) => {
  userUnloadedHandler = handler;
  return unsubscribeUnloaded;
});
const signout = vi.fn();

vi.mock("./userManager", () => ({
  userManager: {
    events: {
      addUserLoaded: (handler: (user: User) => void) => addUserLoaded(handler),
      addUserUnloaded: (handler: () => void) => addUserUnloaded(handler),
    },
  },
  restoreSession: () => restoreSession(),
  signin: vi.fn(),
  signout: () => signout(),
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  userLoadedHandler = undefined;
  userUnloadedHandler = undefined;
  restoreSession.mockReset().mockResolvedValue(null);
  addUserLoaded.mockClear();
  addUserUnloaded.mockClear();
  unsubscribeLoaded.mockClear();
  unsubscribeUnloaded.mockClear();
  signout.mockReset();
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

  it("userUnloaded após userLoaded válido: volta a anonymous e limpa o cache do queryClient", async () => {
    const queryClient = renderProbe();
    await act(async () => {
      await Promise.resolve();
    });

    expect(userLoadedHandler).toBeDefined();
    act(() => {
      userLoadedHandler?.(asUser({ sub: "u1", name: "Ana", email: "ana@example.com" }));
    });

    const probe = screen.getByTestId("probe");
    expect(probe.dataset.status).toBe("authenticated");

    queryClient.setQueryData(["userinfo", "u1"], {
      sub: "u1",
      name: "Ana",
      email: "ana@example.com",
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);

    expect(userUnloadedHandler).toBeDefined();
    act(() => {
      userUnloadedHandler?.();
    });

    expect(probe.dataset.status).toBe("anonymous");
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("unmount desinscreve os dois handlers de evento", async () => {
    const { unmount } = render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(unsubscribeLoaded).not.toHaveBeenCalled();
    expect(unsubscribeUnloaded).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribeLoaded).toHaveBeenCalledTimes(1);
    expect(unsubscribeUnloaded).toHaveBeenCalledTimes(1);
  });
});
