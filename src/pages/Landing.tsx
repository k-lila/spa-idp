import { useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthContext";

export function Landing() {
  const auth = useAuth();
  const [failed, setFailed] = useState(false);
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
    </main>
  );
}
