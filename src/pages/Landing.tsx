import { useState } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";

export function Landing() {
  const auth = useAuth();
  const [failed, setFailed] = useState(false);
  const signoutFailed = hasSignoutFailed(useLocation().state);
  // Ainda não se sabe se há sessão: nada de "Entrar" antes de restoreSession() responder (ADR 0014).
  if (auth.status === "loading") return null;
  if (auth.status === "authenticated") return <Navigate to="/app" replace />;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">nova_api_SPA</h1>
      <p className="text-neutral-600">Relying Party OIDC do monolito-idp.</p>
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          // signin() só rejeita se o redirect não chegou a sair (discovery fora, IdP derrubado).
          void auth.signin().catch((err: unknown) => {
            console.error(err);
            setFailed(true);
          });
        }}
        className="rounded bg-neutral-900 px-4 py-2 text-white"
      >
        Entrar
      </button>
      {failed && (
        <p role="alert" className="text-red-700">
          Não foi possível iniciar o login.
        </p>
      )}
      {signoutFailed && (
        <p role="alert" className="text-red-700">
          Não foi possível encerrar a sessão no provedor de identidade.
        </p>
      )}
    </main>
  );
}

// Estado de navegação que o "Sair" de /app deixa quando o logout não chegou ao IdP (ADR 0019).
function hasSignoutFailed(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    "signoutFailed" in state &&
    state.signoutFailed === true
  );
}
