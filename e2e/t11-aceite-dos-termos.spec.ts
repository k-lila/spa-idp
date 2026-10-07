import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { claimsSection, login } from "./idp";

// O fake guarda as contas em memória pelo processo inteiro e o servidor é reaproveitado entre
// execuções: um sufixo novo a cada execução dá uma conta nova, sem aceite, e o teste não depende da
// ordem nem de execução anterior.
test("conta sem aceite passa por /app/termos, aceita e volta a /app", async ({ page }) => {
  const caminhos: string[] = [];
  const eventos: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) caminhos.push(new URL(frame.url()).pathname);
  });
  page.on("request", (req) => {
    const { pathname } = new URL(req.url());
    if (pathname.startsWith("/api/conta/") && req.method() !== "OPTIONS") {
      eventos.push(`${req.method()}:${pathname}`);
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Entrar" }).click();
  await login(page, `sem-aceite:${randomUUID()}`);

  await page.waitForURL((url) => url.pathname === "/app/termos");
  // Passou por /app antes de a guarda redirecionar.
  expect(caminhos).toContain("/app");
  expect(caminhos.indexOf("/app")).toBeLessThan(caminhos.indexOf("/app/termos"));

  // A área não aparece enquanto os termos não foram aceitos.
  await expect(page.getByRole("heading", { name: "id_token" })).toHaveCount(0);

  const aceitar = page.getByRole("button", { name: "Aceitar" });
  await expect(aceitar).toBeDisabled();
  await page.getByLabel(/Li e aceito.*\(versão 1\)/).check();
  await expect(aceitar).toBeEnabled();

  const [post] = await Promise.all([
    page.waitForResponse(
      (res) =>
        new URL(res.url()).pathname === "/api/conta/termos/" && res.request().method() === "POST",
    ),
    aceitar.click(),
  ]);
  expect(post.request().postDataJSON()).toEqual({ versao: "1" });
  expect(post.status()).toBe(204);

  await page.waitForURL((url) => url.pathname === "/app");
  await expect(claimsSection(page, "userinfo").locator("dd")).toHaveCount(3);

  // Um GET da conta depois do POST: a guarda revalidou antes de liberar a área.
  const iPost = eventos.indexOf("POST:/api/conta/termos/");
  expect(iPost).toBeGreaterThanOrEqual(0);
  expect(eventos.slice(iPost + 1)).toContain("GET:/api/conta/");
});
