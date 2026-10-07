import { Link } from "react-router";
import { TERMOS_VERSAO, TEXTO_PRIVACIDADE } from "../termos";

export function Privacidade() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-3xl font-semibold">Política de privacidade</h1>
      <p className="text-neutral-600">Versão {TERMOS_VERSAO}</p>
      <p className="whitespace-pre-line">{TEXTO_PRIVACIDADE}</p>
      <Link to="/" className="underline">
        Voltar ao início
      </Link>
    </main>
  );
}
