import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { config } from "../config";
import { TERMOS_VERSAO } from "../termos";
import { authGet, authSend } from "./http";

// Corpo do GET e do PATCH (docs/contrato-idp.md §11.1). Schema próprio, não o das claims:
// `updated_at` aqui é ISO, lá é epoch — nunca comparar os dois. As datas ficam `string`: o formato
// exato do ISO é do IdP, e só a exibição as interpreta.
export const contaSchema = z.object({
  sub: z.string().min(1),
  email: z.string().min(1),
  email_verified: z.boolean(),
  first_name: z.string(),
  last_name: z.string(),
  nickname: z.string(),
  date_joined: z.string(),
  updated_at: z.string(),
  senha_alterada_em: z.string().nullable(),
  termos_versao: z.string(),
  termos_versao_vigente: z.string(),
});
export type Conta = z.infer<typeof contaSchema>;

const erroDeCampoSchema = z.object({ codigo: z.string(), mensagem: z.string() });
export type ErroDeCampo = z.infer<typeof erroDeCampoSchema>;

export const errosSchema = z.object({ erros: z.record(z.string(), z.array(erroDeCampoSchema)) });

// Os `403` com corpo (`conta_inativa`, `aplicacao_nao_autorizada`). O de `insufficient_scope` não
// tem corpo e fica sem `codigo`: erro genérico (ADR 0020, D-1).
const codigoSchema = z.object({ codigo: z.string() });

export class ContaError extends Error {
  readonly status: number;
  readonly codigo?: string;
  readonly erros?: Record<string, ErroDeCampo[]>;

  constructor(status: number, codigo?: string, erros?: Record<string, ErroDeCampo[]>) {
    super(`API de conta respondeu ${status}${codigo ? ` (${codigo})` : ""}`);
    this.status = status;
    this.codigo = codigo;
    this.erros = erros;
  }
}

async function falha(res: Response): Promise<ContaError> {
  const corpo: unknown = await res.json().catch(() => undefined);
  const erros = errosSchema.safeParse(corpo);
  const codigo = codigoSchema.safeParse(corpo);
  return new ContaError(
    res.status,
    codigo.success ? codigo.data.codigo : undefined,
    erros.success ? erros.data.erros : undefined,
  );
}

// Como no userinfo: a conta tem de ser a da identidade do id_token (ADR 0020, D-12).
async function lerConta(res: Response, expectedSub: string): Promise<Conta> {
  const conta = contaSchema.parse(await res.json());
  if (conta.sub !== expectedSub) throw new Error("conta: sub divergente do id_token");
  return conta;
}

export async function fetchConta(expectedSub: string): Promise<Conta> {
  const res = await authGet(config.idp.api.conta);
  if (!res.ok) throw await falha(res);
  return lerConta(res, expectedSub);
}

// `sub` na chave, como no userinfo. Retentativa, foco e `staleTime` no padrão do queryClient (D-15).
// Quem busca é a guarda; os filhos dela passam `refetchOnMount: false` e só leem o cache. O foco
// fica ligado em todos: o TanStack refaz a busca uma vez por query, não por observador.
export function useConta(sub: string, opcoes: { refetchOnMount?: false } = {}) {
  return useQuery({ queryKey: ["conta", sub], queryFn: () => fetchConta(sub), ...opcoes });
}

export type CamposEditaveis = Pick<Conta, "first_name" | "last_name" | "nickname">;

// Um `400` chega como `ContaError` com `erros` por campo.
export function useEditarConta(sub: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campos: Partial<CamposEditaveis>) => {
      const res = await authSend("PATCH", "conta", campos);
      if (res.status !== 200) throw await falha(res);
      return lerConta(res, sub);
    },
    // Um GET por foco ainda em voo chegaria depois do 200 e voltaria o cache à conta antiga.
    onMutate: () => queryClient.cancelQueries({ queryKey: ["conta", sub] }),
    onSuccess: (conta) => {
      queryClient.setQueryData(["conta", sub], conta);
      // O userinfo repete nome e apelido: a área não pode mostrar o valor antigo.
      return queryClient.invalidateQueries({ queryKey: ["userinfo", sub] });
    },
  });
}

export function useReenviarConfirmacao() {
  return useMutation({
    mutationFn: async () => {
      const res = await authSend("POST", "confirmacao");
      if (res.status !== 204) throw await falha(res);
    },
  });
}

export function useAceitarTermos(sub: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await authSend("POST", "termos", { versao: TERMOS_VERSAO });
      if (res.status !== 204) throw await falha(res);
    },
    // Esperar a conta nova mantém o aceite pendente até a guarda ver os termos aceitos.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conta", sub] }),
  });
}

// Map, não objeto: o código vem do IdP, e num objeto "constructor" acharia algo que não é texto.
const MENSAGENS = new Map([
  ["max_length", "Use no máximo 150 caracteres."],
  ["invalid", "Valor inválido."],
  [
    "termos_desatualizados",
    "Os termos foram atualizados e esta página ainda não tem a versão nova. Tente mais tarde.",
  ],
]);

export const MENSAGEM_429 = "Muitas tentativas. Tente de novo em instantes.";

// Código desconhecido cai na `mensagem` do IdP, em inglês: melhor que nada (contrato §11.2).
export function mensagemDoErro({ codigo, mensagem }: ErroDeCampo): string {
  return MENSAGENS.get(codigo) ?? mensagem;
}
