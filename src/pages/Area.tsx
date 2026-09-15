import { useAuth } from "../auth/AuthContext";

export function Area() {
  const auth = useAuth();
  if (auth.status !== "authenticated") return null;

  const { sub, name, email } = auth.user.profile;
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Área autenticada</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left">
        <dt className="text-neutral-600">sub</dt>
        <dd>{sub}</dd>
        <dt className="text-neutral-600">name</dt>
        <dd>{name}</dd>
        <dt className="text-neutral-600">email</dt>
        <dd>{email}</dd>
      </dl>
    </main>
  );
}
