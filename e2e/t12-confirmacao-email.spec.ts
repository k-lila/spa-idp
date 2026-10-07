import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { login } from "./idp";

// `nao-confirmado:<sufixo>` nasce no fake com e-mail não confirmado; o sufixo novo a cada execução
// dá uma conta nova com o servidor reaproveitado.
test("e-mail não confirmado: faixa na área, reenvio em 204 e estado em /app/conta", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar" }).click();
  await login(page, `nao-confirmado:${randomUUID()}`);
  await page.waitForURL((url) => url.pathname === "/app");

  await expect(page.getByText("Confirme seu e-mail")).toBeVisible();
  const reenviar = page.getByRole("button", { name: "Reenviar" });
  await expect(reenviar).toBeVisible();

  // Só o POST: o preflight (OPTIONS) também passa por essa URL.
  const [post] = await Promise.all([
    page.waitForResponse(
      (res) =>
        new URL(res.url()).pathname === "/api/conta/confirmacao/" &&
        res.request().method() === "POST",
    ),
    reenviar.click(),
  ]);
  expect(post.status()).toBe(204);
  await expect(
    page.getByText("Se o e-mail ainda não foi confirmado, enviamos um novo link."),
  ).toBeVisible();

  await page.getByRole("link", { name: "Minha conta" }).click();
  await page.waitForURL((url) => url.pathname === "/app/conta");
  await expect(page.getByText("(não confirmado)")).toBeVisible();
});
