// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { TERMOS_VERSAO, TEXTO_PRIVACIDADE, TEXTO_TERMOS } from "../termos";
import { Privacidade } from "./Privacidade";
import { Termos } from "./Termos";

// Sem AuthProvider e sem mock de useAuth: as páginas são públicas. Se passarem a chamar useAuth,
// o hook lança fora do provider e estes testes falham.
afterEach(() => {
  cleanup();
});

describe.each([
  ["Termos", Termos, "Termos de uso", TEXTO_TERMOS],
  ["Privacidade", Privacidade, "Política de privacidade", TEXTO_PRIVACIDADE],
])("%s", (_nome, Pagina, titulo, texto) => {
  it("mostra o título, a versão e o texto da constante", () => {
    render(
      <MemoryRouter>
        <Pagina />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: titulo })).toBeTruthy();
    expect(TERMOS_VERSAO).toBe("1");
    screen.getByText(`Versão ${TERMOS_VERSAO}`);
    screen.getByText(texto);
  });
});
