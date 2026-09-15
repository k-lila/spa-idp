import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthContext";

export function Landing() {
  const auth = useAuth();
  if (auth.status === "authenticated") return <Navigate to="/app" replace />;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">nova_api_SPA</h1>
      <p className="text-neutral-600">Relying Party OIDC do monolito-idp.</p>
      <button
        type="button"
        onClick={() => void auth.signin()}
        className="rounded bg-neutral-900 px-4 py-2 text-white"
      >
        Entrar
      </button>
    </main>
  );
}
