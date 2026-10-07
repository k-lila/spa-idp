import type { ReactNode } from "react";
import { Navigate, useLocation, useMatch } from "react-router";
import { ContaError, MENSAGEM_429, useConta } from "../api/conta";
import { BotaoSair } from "../pages/BotaoSair";
import { useAuth } from "./AuthContext";

// D-5: a área só abre com os termos vigentes aceitos, segundo o GET da conta. Dentro de RequireAuth.
export function RequireTermos({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.status !== "authenticated") return null;
  return <Guarda sub={auth.claims.sub}>{children}</Guarda>;
}

function Guarda({ sub, children }: { sub: string; children: ReactNode }) {
  const conta = useConta(sub);
  const { pathname, search, hash, state } = useLocation();
  const noAceite = useMatch("/app/termos") !== null;

  // Nada da área antes do primeiro GET terminar: na montagem, nenhuma outra chamada autenticada
  // corre junto com ele. Nas novas buscas por foco, conta e userinfo correm juntos, e a trava de
  // re-auth por URL (D-14) limita o custo a uma ida e volta a mais.
  if (conta.isPending) return null;
  // D-6: qualquer erro fecha a área, mesmo com conta em cache.
  if (conta.isError) {
    return (
      <FalhaDaConta error={conta.error} refetching={conta.isFetching} onRetry={conta.refetch} />
    );
  }

  const aceitos = conta.data.termos_versao === conta.data.termos_versao_vigente;
  if (!aceitos && !noAceite) {
    return <Navigate to="/app/termos" replace state={{ from: pathname + search + hash }} />;
  }
  // Também é o retorno do aceite: a conta revalidada chega aqui antes de AceiteDosTermos poder
  // navegar, então o destino original se decide num lugar só.
  if (aceitos && noAceite) return <Navigate to={destino(state)} replace />;
  return children;
}

// Só caminho interno da área volta; o resto (ausente, adulterado) cai em /app.
function destino(state: unknown): string {
  const from =
    typeof state === "object" && state !== null && "from" in state ? state.from : undefined;
  return typeof from === "string" && (from === "/app" || /^\/app[/?#]/.test(from)) ? from : "/app";
}

function FalhaDaConta({
  error,
  refetching,
  onRetry,
}: {
  error: Error;
  refetching: boolean;
  onRetry: () => unknown;
}) {
  // D-16: tentar de novo não reativa a conta.
  const inativa = error instanceof ContaError && error.codigo === "conta_inativa";
  const limitada = error instanceof ContaError && error.status === 429;
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <p role="alert" className="text-red-700">
        {inativa
          ? "Esta conta está desativada."
          : limitada
            ? MENSAGEM_429
            : "Não foi possível carregar a sua conta."}
      </p>
      {!inativa && (
        <button
          type="button"
          onClick={() => void onRetry()}
          disabled={refetching}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Tentar de novo
        </button>
      )}
      <BotaoSair />
    </main>
  );
}
