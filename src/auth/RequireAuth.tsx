import { useEffect, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

// I8: guarda por redirect. Enquanto não há identidade, nada da área é renderizado.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, signin } = useAuth();

  useEffect(() => {
    if (status === "anonymous") void signin();
  }, [status, signin]);

  return status === "authenticated" ? children : null;
}
