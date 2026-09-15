import { Link } from "react-router";

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Página não encontrada</h1>
      <Link to="/" className="underline">
        Voltar ao início
      </Link>
    </main>
  );
}
