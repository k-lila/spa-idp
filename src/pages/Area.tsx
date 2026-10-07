import { Link } from "react-router";
import { ContaError, MENSAGEM_429, useConta, useReenviarConfirmacao } from "../api/conta";
import { useUserinfo } from "../api/userinfo";
import { useAuth } from "../auth/AuthContext";
import type { Claims } from "../auth/claims";
import { BotaoSair } from "./BotaoSair";

export function Area() {
  const auth = useAuth();
  if (auth.status !== "authenticated") return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Área autenticada</h1>
      <ContaResumo sub={auth.claims.sub} />
      <section className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-medium">id_token</h2>
        <ClaimsList claims={auth.claims} />
      </section>
      <section className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-medium">userinfo</h2>
        <UserinfoSection sub={auth.claims.sub} />
      </section>
      <section className="flex flex-col items-center gap-2">
        <BotaoSair />
      </section>
    </main>
  );
}

// A guarda só abre a área com a conta em cache: aqui não há espera nem erro a tratar, nem nova
// busca ao montar. Saudação pela conta, não pelas claims (ADR 0020, D-11).
function ContaResumo({ sub }: { sub: string }) {
  const { data: conta } = useConta(sub, { refetchOnMount: false });
  if (!conta) return null;
  return (
    <>
      <p className="text-lg">Olá, {conta.nickname || conta.first_name || conta.email}!</p>
      {/* Some sozinha quando a confirmação chega: o foco da aba refaz o GET da conta. */}
      {!conta.email_verified && <FaixaConfirmacao />}
      <Link to="/app/conta" className="underline">
        Minha conta
      </Link>
    </>
  );
}

function FaixaConfirmacao() {
  const reenviar = useReenviarConfirmacao();
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-amber-500 bg-amber-50 p-4">
      <p>Confirme seu e-mail</p>
      <button
        type="button"
        onClick={() => reenviar.mutate()}
        disabled={reenviar.isPending}
        className="rounded border border-neutral-900 px-4 py-2 disabled:opacity-50"
      >
        Reenviar
      </button>
      {reenviar.isSuccess && (
        <p role="status">Se o e-mail ainda não foi confirmado, enviamos um novo link.</p>
      )}
      {reenviar.isError && (
        <p role="alert" className="text-red-700">
          {reenviar.error instanceof ContaError && reenviar.error.status === 429
            ? MENSAGEM_429
            : "Não foi possível reenviar."}
        </p>
      )}
    </div>
  );
}

// Componente próprio para o hook rodar depois do narrowing de Area sem violar as regras de hooks.
function UserinfoSection({ sub }: { sub: string }) {
  const { data, isPending, isError } = useUserinfo(sub);
  if (isPending) return <p className="text-neutral-600">Carregando…</p>;
  if (isError) return <p className="text-red-700">Não foi possível obter o userinfo.</p>;
  return <ClaimsList claims={data} />;
}

function ClaimsList({ claims: { sub, name, email } }: { claims: Claims }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left">
      <dt className="text-neutral-600">sub</dt>
      <dd>{sub}</dd>
      <dt className="text-neutral-600">name</dt>
      <dd>{name === "" ? <span className="text-neutral-600">(sem nome)</span> : name}</dd>
      <dt className="text-neutral-600">email</dt>
      <dd>{email}</dd>
    </dl>
  );
}
