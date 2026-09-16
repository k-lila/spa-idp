import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "./AuthContext";

// O que aconteceu com o signin() desta montagem: rejeitou = não foi ao IdP; resolveu = a página
// voltou do IdP por bfcache. Volta a "pending" só por ação do usuário, então não há laço.
type Outcome = "pending" | "failed" | "returned";

// I8: guarda por redirect. Enquanto não há identidade, nada da área é renderizado.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, signin } = useAuth();
  const { pathname, search, hash } = useLocation();
  const returnTo = pathname + search + hash;
  const [outcome, setOutcome] = useState<Outcome>("pending");
  // Só a entrada sem sessão vai ao IdP. Perder a sessão com a guarda montada é "Sair" em curso:
  // redirecionar aqui mandaria ao IdP, e o SSO devolveria o usuário logado (ADR 0010).
  const hadSession = useRef(false);

  useEffect(() => {
    if (status === "authenticated") {
      hadSession.current = true;
      return;
    }
    if (status !== "anonymous" || hadSession.current || outcome !== "pending") return;
    let active = true;
    signin(returnTo).then(
      () => {
        if (active) setOutcome("returned");
      },
      (err: unknown) => {
        if (active) {
          console.error(err);
          setOutcome("failed");
        }
      },
    );
    return () => {
      active = false;
    };
  }, [status, signin, returnTo, outcome]);

  if (status === "authenticated") return children;
  if (outcome === "pending") return null;
  return <SigninFallback outcome={outcome} onRetry={() => setOutcome("pending")} />;
}

function SigninFallback({
  outcome,
  onRetry,
}: {
  outcome: Exclude<Outcome, "pending">;
  onRetry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-neutral-600">
        {outcome === "failed" ? "Não foi possível iniciar o login." : "O login não foi concluído."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded bg-neutral-900 px-4 py-2 text-white"
      >
        Entrar
      </button>
      <Link to="/" className="underline">
        Voltar ao início
      </Link>
    </main>
  );
}
