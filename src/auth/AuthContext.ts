import { createContext, useContext } from "react";
import type { Claims } from "./claims";

export type AuthState =
  { status: "loading" } | { status: "anonymous" } | { status: "authenticated"; claims: Claims };

export type AuthContextValue = AuthState & {
  signin: (returnTo?: string) => Promise<void>;
  signout: () => Promise<void>;
};

// Separado de AuthProvider.tsx para o arquivo do componente só exportar componente (react-refresh).
export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth fora de <AuthProvider>");
  }
  return value;
}
