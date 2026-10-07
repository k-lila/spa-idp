import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import type { User } from "oidc-client-ts";
import { AuthContext, type AuthState } from "./AuthContext";
import { claimsSchema } from "./claims";
import { restoreSession, signin, signout, signup, userManager } from "./userManager";

// `userLoaded` dispara antes de completeSignin() resolver: este é o portão que impede uma
// identidade rejeitada de virar `authenticated` (I7).
function toState(user: User | null): AuthState {
  const parsed = user ? claimsSchema.safeParse(user.profile) : null;
  return parsed?.success
    ? { status: "authenticated", claims: parsed.data }
    : { status: "anonymous" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    // A identidade chega pelo evento do UserManager, não pelo retorno de completeSignin():
    // assim Callback não precisa conhecer o estado do provider.
    const unsubscribeLoaded = userManager.events.addUserLoaded((user) => setState(toState(user)));
    // Só estado: quem chamou removeUser() é quem navega (ADR 0010) — Callback ainda mostra o erro
    // ao rejeitar claims. O cache do userinfo morre com os tokens (ADR 0009): clear(), não
    // invalidate, para nada refazer a busca sem sessão.
    const unsubscribeUnloaded = userManager.events.addUserUnloaded(() => {
      setState({ status: "anonymous" });
      queryClient.clear();
    });
    void restoreSession().then((user) => setState(toState(user)));
    return () => {
      unsubscribeLoaded();
      unsubscribeUnloaded();
    };
  }, [queryClient]);

  return <AuthContext value={{ ...state, signin, signup, signout }}>{children}</AuthContext>;
}
