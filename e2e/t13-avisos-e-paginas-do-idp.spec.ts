import { expect, test } from "@playwright/test";
import { login } from "./idp";

// A origem dos hrefs vem do issuer de SPA_ENV em playwright.config.ts (http://localhost:9000/o).
const IDP = "http://localhost:9000";

test.describe("avisos das voltas do IdP na landing", () => {
  for (const [query, texto] of [
    ["email=confirmado", "E-mail confirmado. Entre para continuar."],
    ["conta=apagada", "Conta apagada."],
  ]) {
    test(`?${query}: aviso, URL limpa e nada no reload`, async ({ page }) => {
      await page.goto(`/?${query}`);

      await expect(page.getByRole("status").filter({ hasText: texto })).toBeVisible();
      await expect(page).toHaveURL("http://localhost:5173/");

      await page.reload();
      await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
      await expect(page.getByRole("status")).toHaveCount(0);
    });
  }
});

test("?aviso=senha-trocada em /app/conta: aviso e URL limpa", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar" }).click();
  await login(page, "fake-user-1");
  await page.waitForURL((url) => url.pathname === "/app");

  await page.goto("/app/conta?aviso=senha-trocada");

  await expect(page.getByRole("status").filter({ hasText: "Senha trocada." })).toBeVisible();
  await expect(page).toHaveURL("http://localhost:5173/app/conta");
});

test("links às páginas do IdP: href na origem do issuer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Esqueci a senha" })).toHaveAttribute(
    "href",
    `${IDP}/accounts/password_reset/`,
  );

  await page.getByRole("button", { name: "Entrar" }).click();
  await login(page, "fake-user-1");
  await page.waitForURL((url) => url.pathname === "/app");
  await page.getByRole("link", { name: "Minha conta" }).click();
  await page.waitForURL((url) => url.pathname === "/app/conta");

  await expect(page.getByRole("link", { name: "Trocar senha" })).toHaveAttribute(
    "href",
    `${IDP}/accounts/password_change/`,
  );
  await expect(page.getByRole("link", { name: "Trocar e-mail" })).toHaveAttribute(
    "href",
    `${IDP}/accounts/email/`,
  );
  await expect(page.getByRole("link", { name: "Excluir conta" })).toHaveAttribute(
    "href",
    `${IDP}/accounts/excluir/`,
  );
});
