import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { completeSignin } from "../auth/userManager";

export function Callback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    completeSignin().then(
      () => {
        if (active) navigate("/app", { replace: true }); // /callback não fica no histórico
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [navigate]);

  if (failed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-neutral-600">Não foi possível concluir a autenticação.</p>
        <Link to="/" className="underline">
          Voltar ao início
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-neutral-600">Autenticando…</p>
    </main>
  );
}
