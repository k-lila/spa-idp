import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";

export function BotaoSair() {
  const { signout } = useAuth();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      // No sucesso quem navega é o IdP; na falha, o botão, já sem sessão (ADR 0019). Sem
      // `replace`: /app fica no histórico e "Voltar" passa pela guarda.
      onClick={() =>
        void signout().catch((err: unknown) => {
          console.error(err);
          void navigate("/", { state: { signoutFailed: true } });
        })
      }
      className="rounded border border-neutral-900 px-4 py-2"
    >
      Sair
    </button>
  );
}
