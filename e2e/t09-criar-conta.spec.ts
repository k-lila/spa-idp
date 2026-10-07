import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { claimsSection, login } from "./idp";

// "Criar conta" é signup(): o redirect a /o/auth leva prompt=create (ADR 0020). O fake retira
// `create` antes do login, então a prova está na requisição capturada, não na tela de login.
// Um login novo a cada execução dá uma conta nova com o servidor reaproveitado; no fake, sub = login.
test("Criar conta: o redirect a /o/auth leva prompt=create e o login chega a /app", async ({
  page,
}) => {
  const auths: URL[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname === "/o/auth") auths.push(url);
  });

  const usuario = `criar:${randomUUID()}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await login(page, usuario);
  await page.waitForURL((url) => url.pathname === "/app");

  expect(auths.length).toBeGreaterThan(0);
  expect(auths[0]?.searchParams.get("prompt")?.split(" ")).toContain("create");
  await expect(claimsSection(page, "id_token").locator("dd").first()).toHaveText(usuario);
});
