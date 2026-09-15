import { useEffect, useState, type ReactNode } from "react";
import { AuthContext, type AuthState } from "./AuthContext";
import { restoreSession, signin, userManager } from "./userManager";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    // A identidade chega pelo evento do UserManager, não pelo retorno de completeSignin():
    // assim Callback não precisa conhecer o estado do provider.
    const unsubscribe = userManager.events.addUserLoaded((user) =>
      setState({ status: "authenticated", user }),
    );
    void restoreSession().then((user) =>
      setState(user ? { status: "authenticated", user } : { status: "anonymous" }),
    );
    return unsubscribe;
  }, []);

  return <AuthContext value={{ ...state, signin }}>{children}</AuthContext>;
}
