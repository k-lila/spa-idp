import { expect, test } from "@playwright/test";
import { claimsSection, login } from "./idp";

// AC-04 da TASK-005, adiado para a etapa 7. "redirect iniciado de dentro de uma consulta do
// TanStack -> SSO real -> página recarregada em /app -> consulta refeita e marcador limpo"
// cruza lib, IdP e cache; nada abaixo do e2e enxerga isso. O fake não tem 401 sob demanda: o
// stub de rede é o único ponto não-real e fica restrito à resposta da PRIMEIRA chamada a
// /o/me. O preflight OPTIONS segue para o servidor real (ele já resolve CORS via
// clientBasedCORS) — só a resposta GET é substituída.

test("401 no userinfo dispara re-auth por redirect e volta com userinfo preenchido", async ({
  page,
}) => {
  let meCount = 0;
  let authCount = 0;

  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/o/auth") authCount += 1;
  });

  await page.route("**/o/me", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    meCount += 1;
    if (meCount === 1) {
      await route.fulfill({
        status: 401,
        headers: {
          "www-authenticate": "Bearer",
          "access-control-allow-origin": "http://localhost:5173",
        },
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Entrar" }).click();
  await login(page, "fake-user-1");

  await page.waitForURL((url) => url.pathname === "/app"); // 1ª chegada: 401 dispara a re-auth
  await page.waitForURL((url) => url.pathname !== "/app"); // saiu para o IdP via SSO
  await page.waitForURL((url) => url.pathname === "/app"); // voltou por /callback -> /app

  const userinfoSection = claimsSection(page, "userinfo");
  await expect(userinfoSection.locator("dd").first()).toHaveText("fake-user-1");

  expect(meCount).toBe(2);
  expect(authCount).toBe(2);

  const reauthMarker = await page.evaluate(() => sessionStorage.getItem("spa.reauth"));
  expect(reauthMarker).toBeNull();
});
