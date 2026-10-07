import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { config } from "../config";

// Voltas das páginas do IdP (docs/contrato-idp.md §11.3). Map, não objeto: a chave vem da URL, e
// num objeto "constructor" ou "__proto__" achariam algo que não é texto.
const AVISOS = new Map([
  ["email=confirmado", "E-mail confirmado. Entre para continuar."],
  ["email=invalido", "O link de confirmação não vale mais. Entre e peça outro."],
  ["conta=desativada", "Conta desativada. Para reativá-la, fale com quem administra."],
  ["conta=apagada", "Conta apagada."],
]);
const PARAMETROS_DE_AVISO = ["email", "conta"];

export function Landing() {
  const auth = useAuth();
  const [failed, setFailed] = useState<string | null>(null);
  const avisos = useAvisos(auth.status !== "authenticated");
  const signoutFailed = hasSignoutFailed(useLocation().state);
  // Ainda não se sabe se há sessão: nada de "Entrar" antes de restoreSession() responder (ADR 0014).
  if (auth.status === "loading") return null;
  if (auth.status === "authenticated") return <Navigate to="/app" replace />;

  // signin() e signup() só rejeitam se o redirect não chegou a sair (discovery fora, IdP derrubado).
  function redirecionar(iniciar: () => Promise<void>, falha: string) {
    setFailed(null);
    void iniciar().catch((err: unknown) => {
      console.error(err);
      setFailed(falha);
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">SPA</h1>
      <p className="text-neutral-600">Relying Party OIDC do monolito-idp.</p>
      {avisos.map((aviso) => (
        <p key={aviso} role="status" className="text-green-800">
          {aviso}
        </p>
      ))}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => redirecionar(auth.signin, "Não foi possível iniciar o login.")}
          className="rounded bg-neutral-900 px-4 py-2 text-white"
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => redirecionar(auth.signup, "Não foi possível iniciar o cadastro.")}
          className="rounded border border-neutral-900 px-4 py-2"
        >
          Criar conta
        </button>
      </div>
      <p className="text-sm text-neutral-600">
        Com uma sessão já aberta no provedor de identidade, "Criar conta" entra na conta existente.
      </p>
      {/* Página do IdP: navegação de página inteira, nunca fetch (§11.3). */}
      <a href={config.idp.paginas.recuperarSenha} className="underline">
        Esqueci a senha
      </a>
      {failed && (
        <p role="alert" className="text-red-700">
          {failed}
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

// Lidos uma vez e tirados da URL, para não reaparecerem num reload. Valor desconhecido não vira
// texto. O state da navegação segue junto: é nele que vem o signoutFailed. Com sessão, a URL fica
// como está: o <Navigate> a /app já saiu, e limpar a query o desfaria.
function useAvisos(limpar: boolean): string[] {
  const { pathname, search, hash, state } = useLocation();
  const navigate = useNavigate();
  const [avisos] = useState(() => {
    const params = new URLSearchParams(search);
    return PARAMETROS_DE_AVISO.flatMap((nome) => {
      const aviso = AVISOS.get(`${nome}=${params.get(nome) ?? ""}`);
      return aviso ? [aviso] : [];
    });
  });

  useEffect(() => {
    if (!limpar) return;
    const params = new URLSearchParams(search);
    if (!PARAMETROS_DE_AVISO.some((nome) => params.has(nome))) return;
    for (const nome of PARAMETROS_DE_AVISO) params.delete(nome);
    void navigate({ pathname, search: params.toString(), hash }, { replace: true, state });
  }, [limpar, navigate, pathname, search, hash, state]);

  return avisos;
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
