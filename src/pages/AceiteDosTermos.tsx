import { useState } from "react";
import { Link } from "react-router";
import { ContaError, MENSAGEM_429, mensagemDoErro, useAceitarTermos } from "../api/conta";
import { useAuth } from "../auth/AuthContext";
import { config } from "../config";
import { TERMOS_VERSAO } from "../termos";
import { BotaoSair } from "./BotaoSair";

// Quem tira a pessoa daqui depois do 204 é RequireTermos, ao ver a conta revalidada.
export function AceiteDosTermos() {
  const auth = useAuth();
  if (auth.status !== "authenticated") return null;
  return <Aceite sub={auth.claims.sub} />;
}

function Aceite({ sub }: { sub: string }) {
  const [marcado, setMarcado] = useState(false);
  const aceitar = useAceitarTermos(sub);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Termos de uso</h1>
      <p className="text-neutral-600">
        Para continuar, leia e aceite os{" "}
        <Link to="/termos" className="underline">
          termos de uso
        </Link>{" "}
        e a{" "}
        <Link to="/privacidade" className="underline">
          política de privacidade
        </Link>
        .
      </p>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
        Li e aceito os termos de uso e a política de privacidade (versão {TERMOS_VERSAO})
      </label>
      <button
        type="button"
        onClick={() => aceitar.mutate()}
        disabled={!marcado || aceitar.isPending}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
      >
        Aceitar
      </button>
      {aceitar.isError && (
        <p role="alert" className="text-red-700">
          {mensagemDoAceite(aceitar.error)}
        </p>
      )}
      {/* Recusar os termos não impede excluir a conta (ADR 0020). */}
      <div className="flex items-center gap-4">
        <BotaoSair />
        <a href={config.idp.paginas.excluir} className="underline">
          Excluir conta
        </a>
      </div>
    </main>
  );
}

function mensagemDoAceite(error: Error): string {
  if (error instanceof ContaError) {
    if (error.status === 429) return MENSAGEM_429;
    const primeiro = Object.values(error.erros ?? {}).flat()[0];
    if (primeiro) return mensagemDoErro(primeiro);
  }
  return "Não foi possível registrar o aceite.";
}
