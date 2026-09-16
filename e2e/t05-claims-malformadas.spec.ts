import { expect, test } from "@playwright/test";
import { login } from "./idp";

// Debito explícito da TASK-004 A5 — a ordem storeUser -> userLoaded -> resolve da lib está
// pinada só por leitura; a unidade mocka a lib e não vê se uma identidade rejeitada vaza para
// `authenticated` por um instante e a Area chega a montar. A prova de "nunca em /app" é por
// evento (framenavigated), não por ausência momentânea.

test("login com claims malformadas (sem-email) não chega a /app; tentativa é descartada", async ({
  page,
}) => {
  const navigatedPaths: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      navigatedPaths.push(new URL(frame.url()).pathname);
    }
  });

  let meRequested = false;
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/o/me") meRequested = true;
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Entrar" }).click();

  await login(page, "sem-email");

  await expect(page.getByText("Não foi possível concluir a autenticação.")).toBeVisible();
  const backLink = page.getByRole("link", { name: "Voltar ao início" });
  await expect(backLink).toBeVisible();

  expect(navigatedPaths).not.toContain("/app");
  expect(meRequested).toBe(false);

  const sessionKeys = await page.evaluate(() => Object.keys(sessionStorage));
  expect(sessionKeys.some((key) => key.startsWith("oidc.user:"))).toBe(false);

  await backLink.click();

  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});
