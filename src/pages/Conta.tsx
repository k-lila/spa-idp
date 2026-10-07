import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  type CamposEditaveis,
  type Conta as ContaDados,
  ContaError,
  MENSAGEM_429,
  mensagemDoErro,
  useConta,
  useEditarConta,
} from "../api/conta";
import { useAuth } from "../auth/AuthContext";
import { config } from "../config";
import { BotaoSair } from "./BotaoSair";

// Voltas das páginas do IdP (docs/contrato-idp.md §11.3). Map, não objeto: a chave vem da URL, e
// num objeto "constructor" ou "__proto__" achariam algo que não é texto.
const AVISOS = new Map([
  ["senha-trocada", "Senha trocada."],
  ["email-trocado", "E-mail trocado. Confirme o novo endereço pelo link enviado."],
]);

const CAMPOS: { nome: keyof CamposEditaveis; rotulo: string; ajuda?: string }[] = [
  { nome: "first_name", rotulo: "Nome" },
  { nome: "last_name", rotulo: "Sobrenome" },
  { nome: "nickname", rotulo: "Apelido", ajuda: "Como prefere ser chamado?" },
];

export function Conta() {
  const auth = useAuth();
  if (auth.status !== "authenticated") return null;
  return <MinhaConta sub={auth.claims.sub} />;
}

function MinhaConta({ sub }: { sub: string }) {
  const aviso = useAviso();
  // A guarda só abre a área com a conta em cache: ler sem buscar de novo.
  const { data: conta } = useConta(sub, { refetchOnMount: false });
  if (!conta) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">Minha conta</h1>
      {aviso && (
        <p role="status" className="text-green-800">
          {aviso}
        </p>
      )}
      <Formulario sub={sub} conta={conta} />
      <section className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-medium">Acesso</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left">
          <dt className="text-neutral-600">E-mail</dt>
          <dd>
            {conta.email} ({conta.email_verified ? "confirmado" : "não confirmado"})
          </dd>
          <dt className="text-neutral-600">Senha alterada em</dt>
          <dd>{formatarData(conta.senha_alterada_em)}</dd>
        </dl>
        {/* Páginas do IdP: navegação de página inteira, nunca fetch (§11.3). */}
        <div className="flex gap-4">
          <a href={config.idp.paginas.trocarSenha} className="underline">
            Trocar senha
          </a>
          <a href={config.idp.paginas.trocarEmail} className="underline">
            Trocar e-mail
          </a>
        </div>
      </section>
      <section className="flex flex-col items-center gap-2 rounded border border-red-700 p-4">
        <h2 className="text-xl font-medium text-red-700">Zona de perigo</h2>
        {/* Não prometer o que o IdP pode recusar (pre-implementacao §5). */}
        <p className="text-neutral-600">
          Na página de exclusão você escolhe entre desativar a conta, que deixa de entrar e só volta
          por quem administra, e apagá-la. Contas da equipe não são excluídas por lá, e uma conta
          responsável por aplicações cadastradas é desativada em vez de apagada.
        </p>
        <a href={config.idp.paginas.excluir} className="text-red-700 underline">
          Excluir conta
        </a>
      </section>
      <div className="flex items-center gap-4">
        <Link to="/app" className="underline">
          Voltar à área
        </Link>
        <BotaoSair />
      </div>
    </main>
  );
}

// Lido uma vez e tirado da URL, para não reaparecer num reload. Valor desconhecido não vira texto.
function useAviso(): string | undefined {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const [aviso] = useState(() => AVISOS.get(new URLSearchParams(search).get("aviso") ?? ""));

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (!params.has("aviso")) return;
    params.delete("aviso");
    void navigate({ pathname, search: params.toString(), hash }, { replace: true });
  }, [navigate, pathname, search, hash]);

  return aviso;
}

// Inicializado uma vez: a nova busca da conta por foco não apaga o que está sendo digitado.
function Formulario({ sub, conta }: { sub: string; conta: ContaDados }) {
  const editar = useEditarConta(sub);
  const [inicial, setInicial] = useState<CamposEditaveis>(() => editaveis(conta));
  const [campos, setCampos] = useState(inicial);
  const erros = errosDoEnvio(editar.error);
  const form = useRef<HTMLFormElement>(null);

  // O fieldset desabilitado no envio deixa o foco no body. Volta ao primeiro campo inválido, que
  // lê o erro pelo aria-describedby, ou ao "Salvar".
  useEffect(() => {
    if (editar.status !== "success" && editar.status !== "error") return;
    const alvo =
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form.current?.querySelector<HTMLElement>('[type="submit"]');
    alvo?.focus();
  }, [editar.status]);

  function enviar(e: FormEvent) {
    e.preventDefault();
    // Só os alterados (ausente no PATCH não apaga): campo não tocado não sobrescreve o que mudou
    // por outro caminho. No mesmo campo, vence a última escrita.
    const alterados: Partial<CamposEditaveis> = {};
    for (const { nome } of CAMPOS) {
      if (campos[nome] !== inicial[nome]) alterados[nome] = campos[nome];
    }
    if (Object.keys(alterados).length === 0) return;
    editar.mutate(alterados, {
      onSuccess: (salva) => {
        setInicial(editaveis(salva));
        setCampos(editaveis(salva));
      },
    });
  }

  return (
    <form ref={form} onSubmit={enviar} className="flex w-full max-w-sm flex-col gap-4 text-left">
      <fieldset disabled={editar.isPending} className="flex flex-col gap-4">
        {CAMPOS.map(({ nome, rotulo, ajuda }) => (
          <div key={nome} className="flex flex-col gap-1">
            <label htmlFor={nome}>{rotulo}</label>
            <input
              id={nome}
              type="text"
              value={campos[nome]}
              maxLength={150}
              aria-invalid={erros.campos[nome] !== undefined}
              aria-describedby={
                [ajuda && `${nome}-ajuda`, erros.campos[nome] && `${nome}-erro`]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              onChange={(e) => {
                editar.reset();
                setCampos({ ...campos, [nome]: e.target.value });
              }}
              className="rounded border border-neutral-400 px-2 py-1"
            />
            {ajuda && (
              <p id={`${nome}-ajuda`} className="text-sm text-neutral-600">
                {ajuda}
              </p>
            )}
            {erros.campos[nome] && (
              <p id={`${nome}-erro`} className="text-sm text-red-700">
                {erros.campos[nome]}
              </p>
            )}
          </div>
        ))}
        <button
          type="submit"
          className="self-center rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Salvar
        </button>
      </fieldset>
      {/* Montada sempre: região viva que nasce com o texto pode não ser anunciada. */}
      <p role="status" className="text-center text-green-800">
        {editar.isSuccess && "Alterações salvas."}
      </p>
      {erros.geral && (
        <p role="alert" className="text-center text-red-700">
          {erros.geral}
        </p>
      )}
    </form>
  );
}

function editaveis({ first_name, last_name, nickname }: ContaDados): CamposEditaveis {
  return { first_name, last_name, nickname };
}

function errosDoEnvio(error: Error | null): {
  campos: Partial<Record<keyof CamposEditaveis, string>>;
  geral?: string;
} {
  if (!error) return { campos: {} };
  if (error instanceof ContaError && error.status === 429) {
    return { campos: {}, geral: MENSAGEM_429 };
  }
  const erros = error instanceof ContaError ? (error.erros ?? {}) : {};
  const primeira = (campo: string) => {
    const erro = erros[campo]?.[0];
    return erro && mensagemDoErro(erro);
  };
  const campos = {
    first_name: primeira("first_name"),
    last_name: primeira("last_name"),
    nickname: primeira("nickname"),
  };
  // `geral` (ex.: `json_invalido`) ou qualquer falha sem erro num dos três campos.
  const semCampo = Object.values(campos).every((m) => m === undefined);
  return {
    campos,
    geral: primeira("geral") ?? (semCampo ? "Não foi possível salvar." : undefined),
  };
}

// O IdP carimba a data já na criação da conta: `null` só vem de conta anterior ao campo, e não
// quer dizer "nunca trocada". O ISO é interpretado, não medido (os microssegundos são opcionais);
// data que não se lê não derruba a tela.
function formatarData(iso: string | null): string {
  if (iso === null) return "sem registro";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(data);
}
