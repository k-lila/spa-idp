// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authSend, signout, useAuth } = vi.hoisted(() => ({
  authSend: vi.fn(),
  signout: vi.fn(),
  useAuth: vi.fn(),
}));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => useAuth() }));
vi.mock("../api/http", () => ({ authGet: vi.fn(), authSend }));
// config.ts lança no import se faltarem VITE_*; a tela só lê config.idp (como em AceiteDosTermos).
vi.mock("../config", () => ({
  config: {
    idp: {
      api: {
        conta: "http://idp.test/api/conta/",
        confirmacao: "http://idp.test/api/conta/confirmacao/",
        termos: "http://idp.test/api/conta/termos/",
      },
      paginas: {
        trocarSenha: "http://idp.test/accounts/password_change/",
        trocarEmail: "http://idp.test/accounts/email/",
        excluir: "http://idp.test/accounts/excluir/",
      },
    },
  },
}));

import { Conta } from "./Conta";

const CONTA = {
  sub: "u1",
  email: "a@x.com",
  email_verified: true,
  first_name: "Ana",
  last_name: "Silva",
  nickname: "Lila",
  date_joined: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  senha_alterada_em: null,
  termos_versao: "1",
  termos_versao_vigente: "1",
};

function resposta(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json:
      body === undefined
        ? vi.fn().mockRejectedValue(new SyntaxError("sem corpo"))
        : vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function montar(conta: object = CONTA, entrada = "/app/conta") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // A guarda só abre a área com a conta em cache: aqui o cache é semeado.
  queryClient.setQueryData(["conta", "u1"], conta);
  const router = createMemoryRouter(
    [
      { path: "/app/conta", element: <Conta /> },
      { path: "/app", element: <div>AREA</div> },
    ],
    { initialEntries: [entrada] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

const campo = (rotulo: string) => screen.getByLabelText<HTMLInputElement>(rotulo);

function digitar(rotulo: string, valor: string) {
  fireEvent.change(campo(rotulo), { target: { value: valor } });
}

function salvar() {
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
}

function idsDe(el: HTMLElement): string[] {
  return (el.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
}

function textoDoId(id: string): string | null | undefined {
  return document.getElementById(id)?.textContent;
}

function errosDeCampo(): Element[] {
  return Array.from(document.querySelectorAll('[id$="-erro"]'));
}

// O formulário mantém um role="status" sempre montado (vazio); o aviso da volta do IdP é outro nó.
// Sem aviso, a única região viva é a do formulário e ela está vazia.
function expectSemAviso() {
  expect(screen.getAllByRole("status").map((el) => el.textContent)).toEqual([""]);
}

beforeEach(() => {
  vi.resetAllMocks();
  useAuth.mockReturnValue({ status: "authenticated", claims: { sub: "u1" }, signout });
});

afterEach(() => {
  cleanup();
});

describe("Conta: formulário", () => {
  it("T-04) os inputs nascem com os valores da conta, maxLength 150 e ajuda no Apelido", async () => {
    montar();

    await screen.findByRole("heading", { name: "Minha conta" });
    expect(campo("Nome").value).toBe("Ana");
    expect(campo("Sobrenome").value).toBe("Silva");
    expect(campo("Apelido").value).toBe("Lila");
    for (const rotulo of ["Nome", "Sobrenome", "Apelido"]) {
      expect(campo(rotulo).maxLength).toBe(150);
    }
    const ids = idsDe(campo("Apelido"));
    expect(ids.map(textoDoId)).toContain("Como prefere ser chamado?");
  });

  it("T-04) editar só o Nome envia só o Nome no PATCH", async () => {
    authSend.mockResolvedValue(resposta(200, { ...CONTA, first_name: "Nova" }));
    montar();
    await screen.findByRole("heading", { name: "Minha conta" });

    digitar("Nome", "Nova");
    salvar();

    await screen.findByText("Alterações salvas.");
    expect(authSend).toHaveBeenCalledTimes(1);
    expect(authSend).toHaveBeenCalledWith("PATCH", "conta", { first_name: "Nova" });
  });

  it("T-04) durante o envio o fieldset fica desabilitado e volta a habilitar depois", async () => {
    let liberar!: (r: Response) => void;
    authSend.mockImplementation(() => new Promise<Response>((res) => (liberar = res)));
    montar();
    await screen.findByRole("heading", { name: "Minha conta" });
    const fieldset = document.querySelector("fieldset");
    if (fieldset === null) throw new Error("fieldset não encontrado");
    expect(fieldset.disabled).toBe(false);

    digitar("Nome", "Nova");
    salvar();

    await waitFor(() => expect(fieldset.disabled).toBe(true));
    liberar(resposta(200, { ...CONTA, first_name: "Nova" }));
    await screen.findByText("Alterações salvas.");
    expect(fieldset.disabled).toBe(false);
  });

  it("T-04) com 200 os inputs mostram o corpo da resposta, e digitar apaga 'Alterações salvas.'", async () => {
    authSend.mockResolvedValue(
      resposta(200, { ...CONTA, first_name: "Servidor", last_name: "Corrigido", nickname: "" }),
    );
    montar();
    await screen.findByRole("heading", { name: "Minha conta" });

    digitar("Nome", "Digitado");
    salvar();

    await screen.findByText("Alterações salvas.");
    await waitFor(() => expect(campo("Nome").value).toBe("Servidor"));
    expect(campo("Sobrenome").value).toBe("Corrigido");
    expect(campo("Apelido").value).toBe("");

    digitar("Nome", "Outra");
    expect(screen.queryByText("Alterações salvas.")).toBeNull();
    expect(campo("Nome").value).toBe("Outra");
  });

  it("T-14) editar só o Nome envia só first_name", async () => {
    authSend.mockResolvedValue(resposta(200, { ...CONTA, first_name: "Nova" }));
    montar();
    await screen.findByRole("heading", { name: "Minha conta" });

    digitar("Nome", "Nova");
    salvar();

    await screen.findByText("Alterações salvas.");
    expect(authSend).toHaveBeenCalledTimes(1);
    const corpo = authSend.mock.calls[0]?.[2] as object;
    expect(Object.keys(corpo)).toEqual(["first_name"]);
    expect(corpo).toEqual({ first_name: "Nova" });
  });

  it("T-14) editar um campo e devolver ao valor original não o inclui", async () => {
    authSend.mockResolvedValue(resposta(200, { ...CONTA, nickname: "Novo" }));
    montar();
    await screen.findByRole("heading", { name: "Minha conta" });

    digitar("Nome", "Outro");
    digitar("Nome", "Ana");
    digitar("Apelido", "Novo");
    salvar();

    await screen.findByText("Alterações salvas.");
    expect(authSend).toHaveBeenCalledTimes(1);
    expect(authSend).toHaveBeenCalledWith("PATCH", "conta", { nickname: "Novo" });
  });

  it("T-14) nenhum campo alterado: Salvar não chama authSend", async () => {
    montar();
    await screen.findByRole("heading", { name: "Minha conta" });

    // O mutationFn roda depois do onMutate assíncrono: esvaziar as microtarefas antes de afirmar o negativo.
    await act(async () => salvar());
    expect(authSend).not.toHaveBeenCalled();

    digitar("Nome", "Outro");
    digitar("Nome", "Ana");
    await act(async () => salvar());
    expect(authSend).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("T-15) depois do 200 a base é o corpo normalizado: novo Salvar sem edição não envia", async () => {
    authSend.mockResolvedValueOnce(resposta(200, { ...CONTA, first_name: "Servidor" }));
    montar();
    await screen.findByRole("heading", { name: "Minha conta" });

    digitar("Nome", "  Digitado ");
    salvar();
    await screen.findByText("Alterações salvas.");
    await waitFor(() => expect(campo("Nome").value).toBe("Servidor"));
    expect(authSend).toHaveBeenCalledTimes(1);

    await act(async () => salvar());

    expect(authSend).toHaveBeenCalledTimes(1);
  });

  it("T-15) depois do 200 normalizado, editar outro campo envia só ele", async () => {
    authSend.mockResolvedValueOnce(resposta(200, { ...CONTA, first_name: "Servidor" }));
    authSend.mockResolvedValueOnce(
      resposta(200, { ...CONTA, first_name: "Servidor", last_name: "Novo" }),
    );
    montar();
    await screen.findByRole("heading", { name: "Minha conta" });

    digitar("Nome", "  Digitado ");
    salvar();
    await waitFor(() => expect(campo("Nome").value).toBe("Servidor"));

    digitar("Sobrenome", "Novo");
    salvar();

    await waitFor(() => expect(authSend).toHaveBeenCalledTimes(2));
    expect(authSend).toHaveBeenLastCalledWith("PATCH", "conta", { last_name: "Novo" });
  });

  it("T-06) a conta que muda no cache não apaga o que está sendo digitado", async () => {
    const { queryClient } = montar();
    await screen.findByRole("heading", { name: "Minha conta" });

    digitar("Nome", "Digitado");
    act(() => {
      // E-mail novo junto: prova que a tela re-renderizou com a conta nova antes da asserção.
      queryClient.setQueryData(["conta", "u1"], {
        ...CONTA,
        first_name: "Servidor",
        email: "novo@x.com",
      });
    });

    await screen.findByText("novo@x.com (confirmado)");
    expect(campo("Nome").value).toBe("Digitado");
  });
});

describe("Conta: erros do PATCH", () => {
  const erro = (campo: string, codigo: string, mensagem = "msg do IdP") => ({
    erros: { [campo]: [{ codigo, mensagem }] },
  });

  async function enviarComErro(res: Response) {
    authSend.mockResolvedValue(res);
    montar();
    await screen.findByRole("heading", { name: "Minha conta" });
    digitar("Nome", "Nova");
    salvar();
  }

  it("T-05) 400 max_length no Apelido: erro sob o campo, aria-invalid só nele e ids na descrição", async () => {
    await enviarComErro(resposta(400, erro("nickname", "max_length")));

    await screen.findByText("Use no máximo 150 caracteres.");
    expect(textoDoId("nickname-erro")).toBe("Use no máximo 150 caracteres.");
    expect(campo("Apelido").getAttribute("aria-invalid")).toBe("true");
    expect(campo("Nome").getAttribute("aria-invalid")).not.toBe("true");
    expect(campo("Sobrenome").getAttribute("aria-invalid")).not.toBe("true");
    const ids = idsDe(campo("Apelido"));
    expect(ids).toContain("nickname-erro");
    expect(ids).toContain("nickname-ajuda");
    expect(idsDe(campo("Nome")).some((id) => id.endsWith("-erro"))).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("T-05) 400 invalid: 'Valor inválido.' sob o campo", async () => {
    await enviarComErro(resposta(400, erro("first_name", "invalid")));

    await screen.findByText("Valor inválido.");
    expect(textoDoId("first_name-erro")).toBe("Valor inválido.");
    expect(campo("Nome").getAttribute("aria-invalid")).toBe("true");
  });

  it.each([["codigo_novo"], ["constructor"], ["__proto__"]])(
    "T-05) código desconhecido '%s' mostra a mensagem do IdP",
    async (codigo) => {
      await enviarComErro(resposta(400, erro("nickname", codigo, "Mensagem em inglês do IdP")));

      await screen.findByText("Mensagem em inglês do IdP");
      expect(textoDoId("nickname-erro")).toBe("Mensagem em inglês do IdP");
    },
  );

  it("T-05) geral json_invalido: role=alert com a mensagem do IdP", async () => {
    await enviarComErro(
      resposta(400, erro("geral", "json_invalido", "The request body must be a JSON object.")),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "The request body must be a JSON object.",
    );
    expect(errosDeCampo()).toHaveLength(0);
  });

  it("T-05) 429: role=alert com a mensagem de muitas tentativas e nenhum erro de campo", async () => {
    await enviarComErro(resposta(429));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Muitas tentativas. Tente de novo em instantes.",
    );
    expect(errosDeCampo()).toHaveLength(0);
  });

  it("T-05) 403 sem corpo: 'Não foi possível salvar.'", async () => {
    await enviarComErro(resposta(403));

    expect((await screen.findByRole("alert")).textContent).toBe("Não foi possível salvar.");
    expect(errosDeCampo()).toHaveLength(0);
  });

  it("T-05) 400 com erro só fora dos três campos (versao): 'Não foi possível salvar.'", async () => {
    await enviarComErro(resposta(400, erro("versao", "termos_desatualizados")));

    expect((await screen.findByRole("alert")).textContent).toBe("Não foi possível salvar.");
    expect(errosDeCampo()).toHaveLength(0);
  });

  it.each([
    ["erro de campo", () => resposta(400, erro("nickname", "max_length"))],
    [
      "geral",
      () =>
        resposta(400, erro("geral", "json_invalido", "The request body must be a JSON object.")),
    ],
    ["429", () => resposta(429)],
    ["403 sem corpo", () => resposta(403)],
    ["400 fora dos três", () => resposta(400, erro("versao", "x"))],
  ])("T-05) depois de %s, digitar limpa os erros", async (_, res) => {
    await enviarComErro(res());
    await waitFor(() => {
      expect(screen.queryByRole("alert") ?? errosDeCampo()[0]).toBeTruthy();
    });

    digitar("Sobrenome", "Outro");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(errosDeCampo()).toHaveLength(0);
    expect(campo("Apelido").getAttribute("aria-invalid")).not.toBe("true");
    expect(idsDe(campo("Apelido"))).toEqual(["nickname-ajuda"]);
  });
});

describe("Conta: foco e região viva depois do envio", () => {
  const botaoSalvar = () => screen.getByRole("button", { name: "Salvar" });

  async function enviar(res: Response) {
    authSend.mockResolvedValue(res);
    montar();
    await screen.findByRole("heading", { name: "Minha conta" });
    digitar("Nome", "Nova");
    salvar();
  }

  it("T-17) sucesso: o foco vai para Salvar", async () => {
    await enviar(resposta(200, { ...CONTA, first_name: "Nova" }));

    await screen.findByText("Alterações salvas.");
    await waitFor(() => expect(document.activeElement).toBe(botaoSalvar()));
  });

  it.each([
    ["429", () => resposta(429)],
    [
      "erro geral",
      () => resposta(400, { erros: { geral: [{ codigo: "x", mensagem: "Falhou" }] } }),
    ],
  ])("T-17) %s: o foco vai para Salvar", async (_, res) => {
    await enviar(res());

    await screen.findByRole("alert");
    await waitFor(() => expect(document.activeElement).toBe(botaoSalvar()));
  });

  it("T-17) 400 com erro em nickname: o foco vai para o input Apelido", async () => {
    await enviar(
      resposta(400, { erros: { nickname: [{ codigo: "max_length", mensagem: "longo" }] } }),
    );

    await screen.findByText("Use no máximo 150 caracteres.");
    await waitFor(() => expect(document.activeElement).toBe(campo("Apelido")));
  });

  it("T-18) o role=status do formulário nasce vazio e recebe 'Alterações salvas.' no mesmo nó", async () => {
    authSend.mockResolvedValue(resposta(200, { ...CONTA, first_name: "Nova" }));
    montar();
    await screen.findByRole("heading", { name: "Minha conta" });
    const regiao = screen.getByRole("status");
    expect(regiao.textContent).toBe("");
    expect(regiao.closest("form")).not.toBeNull();

    digitar("Nome", "Nova");
    salvar();

    await waitFor(() => expect(regiao.textContent).toBe("Alterações salvas."));
    expect(screen.getByRole("status")).toBe(regiao);
    expect(regiao.isConnected).toBe(true);
  });
});

describe("Conta: Acesso e zona de perigo", () => {
  it.each([
    [true, "a@x.com (confirmado)"],
    [false, "a@x.com (não confirmado)"],
  ])("T-07) email_verified %s mostra '%s'", async (email_verified, texto) => {
    montar({ ...CONTA, email_verified });

    await screen.findByText(texto);
  });

  it.each([
    [null, "sem registro"],
    ["nao-e-data", "data indisponível"],
  ])("T-07) senha_alterada_em %s mostra '%s'", async (senha_alterada_em, texto) => {
    montar({ ...CONTA, senha_alterada_em });

    await screen.findByText(texto);
  });

  it("T-07) senha_alterada_em ISO mostra a data por extenso em pt-BR", async () => {
    montar({ ...CONTA, senha_alterada_em: "2026-10-06T12:00:00Z" });

    const dd = (await screen.findByText("Senha alterada em")).nextElementSibling;
    // O dia depende do fuso (5, 6 ou 7); o mês e o formato não.
    expect(dd?.textContent).toMatch(/^\d{1,2} de outubro de 2026 às \d{2}:\d{2}$/);
  });

  it.each([
    ["sem microssegundos", "2026-10-06T12:00:00+00:00"],
    ["com microssegundos", "2026-10-06T12:00:00.123456+00:00"],
  ])(
    "T-07b) senha_alterada_em do IdP (isoformat UTC) %s mostra a data por extenso",
    async (_, iso) => {
      montar({ ...CONTA, senha_alterada_em: iso });

      const dd = (await screen.findByText("Senha alterada em")).nextElementSibling;
      expect(dd?.textContent).toMatch(/^\d{1,2} de outubro de 2026 às \d{2}:\d{2}$/);
    },
  );

  it.each([
    ["Trocar senha", "http://idp.test/accounts/password_change/"],
    ["Trocar e-mail", "http://idp.test/accounts/email/"],
    ["Excluir conta", "http://idp.test/accounts/excluir/"],
  ])("T-07) '%s' é um <a> com o href da página do IdP", async (nome, href) => {
    montar();

    const link = await screen.findByRole("link", { name: nome });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(href);
    expect(link.hasAttribute("data-discover")).toBe(false);
  });

  it("T-07) a zona de perigo avisa que contas da equipe não são excluídas e a desativação", async () => {
    montar();

    const zona = (await screen.findByRole("heading", { name: "Zona de perigo" })).closest(
      "section",
    );
    if (zona === null) throw new Error("zona de perigo fora de <section>");
    expect(zona.textContent).toContain("Contas da equipe não são excluídas");
    expect(zona.textContent).toContain("desativada em vez de apagada");
    within(zona).getByRole("link", { name: "Excluir conta" });
  });
});

describe("Conta: aviso da volta das páginas do IdP", () => {
  it("T-08) senha-trocada mostra o aviso e tira só o aviso da URL, por REPLACE", async () => {
    const { router } = montar(CONTA, "/app/conta?x=1&aviso=senha-trocada#h");

    await screen.findByText("Senha trocada.");
    await waitFor(() => expect(router.state.location.search).toBe("?x=1"));
    expect(router.state.location.hash).toBe("#h");
    expect(router.state.location.pathname).toBe("/app/conta");
    expect(router.state.historyAction).toBe("REPLACE");
    screen.getByText("Senha trocada.");
  });

  it("T-08) email-trocado mostra o aviso do e-mail", async () => {
    montar(CONTA, "/app/conta?aviso=email-trocado");

    await screen.findByText("E-mail trocado. Confirme o novo endereço pelo link enviado.");
  });

  it.each([["desconhecido"], ["constructor"], ["__proto__"]])(
    "T-08) aviso '%s' não mostra aviso, mas sai da URL",
    async (valor) => {
      const { router } = montar(CONTA, `/app/conta?aviso=${valor}`);

      await screen.findByRole("heading", { name: "Minha conta" });
      await waitFor(() => expect(router.state.location.search).toBe(""));
      expect(router.state.historyAction).toBe("REPLACE");
      expectSemAviso();
    },
  );

  it("T-08) sem aviso na URL a navegação não é tocada (continua POP)", async () => {
    const { router } = montar(CONTA, "/app/conta?x=1");

    await screen.findByRole("heading", { name: "Minha conta" });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(router.state.historyAction).toBe("POP");
    expect(router.state.location.search).toBe("?x=1");
    expectSemAviso();
  });
});
