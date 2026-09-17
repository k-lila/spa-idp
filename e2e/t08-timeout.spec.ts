import { expect, test, type Route } from "@playwright/test";
import { login } from "./idp";

// requestTimeoutInSeconds: 15 (ADR 0015) é o que corta a espera de descoberta e /o/token/ num
// tempo finito. O stub segura a resposta por 25 s para provar que quem decide é o timeout do
// cliente (15 s), não uma falha imediata do servidor nem o timeout do Playwright.

// setTimeout roda no processo Node do teste, não no browser: sem unref() o timer de 25 s mantém
// o processo vivo bem depois do fim do teste (o cliente já desiste aos 15 s e segue em frente).
// route.abort() após o teste ter fechado a página pode rejeitar; tolerado com .catch.
async function hang25sThenAbort(route: Route): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 25_000);
    timer.unref();
  });
  await route.abort().catch(() => {});
}

test("descoberta pendurada: alerta após 15 s e retentativa", async ({ page }) => {
  let count = 0;
  await page.route("**/o/.well-known/openid-configuration", async (route) => {
    count += 1;
    await hang25sThenAbort(route);
  });

  await page.goto("/");
  const t0 = Date.now();
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("alert")).toHaveText("Não foi possível iniciar o login.", {
    timeout: 20_000,
  });
  const elapsed = Date.now() - t0;
  expect(elapsed).toBeGreaterThan(14_000);
  expect(elapsed).toBeLessThan(19_000);

  // Segundo clique: setFailed(false) é síncrono (mesmo comportamento provado na unidade); o
  // alerta some no ato, antes de qualquer resposta de rede.
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Novo signin() força nova descoberta: a lib não cacheia metadata que falhou.
  expect(count).toBe(2);
});

test("/o/token pendurado: erro no callback, uma requisição, sem sessão", async ({ page }) => {
  let count = 0;
  await page.route("**/o/token", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    count += 1;
    await hang25sThenAbort(route);
  });

  const navigatedPaths: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      navigatedPaths.push(new URL(frame.url()).pathname);
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Entrar" }).click();
  await login(page, "fake-user-1");

  await expect(page.getByText("Não foi possível concluir a autenticação.")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("link", { name: "Voltar ao início" })).toBeVisible();

  expect(count).toBe(1);
  expect(navigatedPaths).not.toContain("/app");

  const sessionKeys = await page.evaluate(() => Object.keys(sessionStorage));
  expect(sessionKeys.some((key) => key.startsWith("oidc.user:"))).toBe(false);

  // getUser() null: com sessão, Landing teria ido direto para /app.
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});
