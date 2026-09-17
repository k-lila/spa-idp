import { useNavigate } from "react-router";
import { useUserinfo } from "../api/userinfo";
import { useAuth } from "../auth/AuthContext";
import type { Claims } from "../auth/claims";

export function Area() {
  const auth = useAuth();
  const navigate = useNavigate();
  if (auth.status !== "authenticated") return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Área autenticada</h1>
      <section className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-medium">id_token</h2>
        <ClaimsList claims={auth.claims} />
      </section>
      <section className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-medium">userinfo</h2>
        <UserinfoSection sub={auth.claims.sub} />
      </section>
      <section className="flex flex-col items-center gap-2">
        <button
          type="button"
          // Navegar só depois de a sessão morrer: com ela viva, Landing devolveria a /app (ADR 0010).
          onClick={() => void auth.signout().then(() => navigate("/"))}
          className="rounded border border-neutral-900 px-4 py-2"
        >
          Sair
        </button>
        <p className="text-sm text-neutral-600">
          Sair só esquece a sessão nesta aplicação. A sessão no provedor de identidade continua
          ativa: um novo Entrar pode acontecer sem pedir senha.
        </p>
      </section>
    </main>
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
