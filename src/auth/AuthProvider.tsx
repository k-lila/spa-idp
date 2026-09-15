import { useEffect, useState, type ReactNode } from "react";
import type { User } from "oidc-client-ts";
import { AuthContext, type AuthState } from "./AuthContext";
import { claimsSchema } from "./claims";
import { restoreSession, signin, userManager } from "./userManager";

// `userLoaded` dispara antes de completeSignin() resolver: este é o portão que impede uma
// identidade rejeitada de virar `authenticated` (I7).
function toState(user: User | null): AuthState {
  const parsed = user ? claimsSchema.safeParse(user.profile) : null;
  return parsed?.success
    ? { status: "authenticated", claims: parsed.data }
    : { status: "anonymous" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    // A identidade chega pelo evento do UserManager, não pelo retorno de completeSignin():
    // assim Callback não precisa conhecer o estado do provider.
    const unsubscribe = userManager.events.addUserLoaded((user) => setState(toState(user)));
    void restoreSession().then((user) => setState(toState(user)));
    return unsubscribe;
  }, []);

  return <AuthContext value={{ ...state, signin }}>{children}</AuthContext>;
}
