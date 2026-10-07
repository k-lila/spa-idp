import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { claimsSection, login } from "./idp";

// O fake guarda as contas em memória pelo processo inteiro e o servidor é reaproveitado entre
// execuções: um login novo a cada execução dá uma conta nova, e o teste não altera `fake-user-1`.
const ehPatchDaConta = (res: { url(): string; request(): { method(): string } }) =>
  new URL(res.url()).pathname === "/api/conta/" && res.request().method() === "PATCH";

test("editar a conta: PATCH com os três campos, persiste no reload e chega à área", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar" }).click();
  await login(page, `editar:${randomUUID()}`);
  await page.waitForURL((url) => url.pathname === "/app");

  await page.getByRole("link", { name: "Minha conta" }).click();
  await page.waitForURL((url) => url.pathname === "/app/conta");

  await page.getByLabel("Nome", { exact: true }).fill("Nova");
  await page.getByLabel("Sobrenome").fill("Pessoa");
  await page.getByLabel("Apelido").fill("Apê");
  const [patch] = await Promise.all([
    page.waitForResponse(ehPatchDaConta),
    page.getByRole("button", { name: "Salvar" }).click(),
  ]);
  expect(patch.request().postDataJSON()).toEqual({
    first_name: "Nova",
    last_name: "Pessoa",
    nickname: "Apê",
  });
  expect(patch.status()).toBe(200);
  await expect(page.getByText("Alterações salvas.")).toBeVisible();

  // Reload: a sessão em memória some, o SSO devolve a /app/conta e a conta vem do servidor.
  await page.reload();
  await page.waitForURL((url) => url.pathname === "/app/conta");
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Nova");
  await expect(page.getByLabel("Sobrenome")).toHaveValue("Pessoa");
  await expect(page.getByLabel("Apelido")).toHaveValue("Apê");

  await page.getByRole("link", { name: "Voltar à área" }).click();
  await page.waitForURL((url) => url.pathname === "/app");
  await expect(page.getByText("Olá, Apê!")).toBeVisible();
  const nameDd = claimsSection(page, "userinfo").locator("dt", { hasText: /^name$/ });
  await expect(nameDd.locator("xpath=following-sibling::dd[1]")).toHaveText("Nova Pessoa");

  // maxLength: o 151º caractere digitado é descartado.
  await page.getByRole("link", { name: "Minha conta" }).click();
  await page.waitForURL((url) => url.pathname === "/app/conta");
  const nome = page.getByLabel("Nome", { exact: true });
  await nome.clear();
  await nome.pressSequentially("a".repeat(151));
  await expect(nome).toHaveValue("a".repeat(150));
});

test("401 no PATCH: re-auth por SSO, volta a /app/conta com o valor do servidor, sem reenviar", async ({
  page,
}) => {
  let patches = 0;
  // Só a resposta do PATCH é substituída, e só a do primeiro; o preflight e o GET seguem ao fake.
  await page.route("**/api/conta/", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    patches += 1;
    if (patches === 1) {
      await route.fulfill({
        status: 401,
        headers: {
          "www-authenticate": 'Bearer error="invalid_token"',
          "access-control-allow-origin": "http://localhost:5173",
          "access-control-expose-headers": "WWW-Authenticate, Retry-After",
        },
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/app/conta");
  await login(page, `editar401:${randomUUID()}`);
  await page.waitForURL((url) => url.pathname === "/app/conta");
  const nome = page.getByLabel("Nome", { exact: true });
  await expect(nome).toHaveValue("Usuária");

  await nome.fill("Perdido");
  await page.getByRole("button", { name: "Salvar" }).click();

  await page.waitForURL((url) => url.pathname !== "/app/conta"); // saiu para o IdP
  await page.waitForURL((url) => url.pathname === "/app/conta"); // voltou por SSO e /callback

  // D-7: o que foi digitado se perde; o formulário mostra o valor do servidor.
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Usuária");
  expect(patches).toBe(1);
});
