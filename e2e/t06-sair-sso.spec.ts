import { expect, test } from "@playwright/test";
import { claimsSection, login } from "./idp";

// Só o IdP real prova que a sessão do provedor sobrevive ao Sair local (ADR 0010: "sessão no
// IdP continua") e que o segundo signinRedirect fecha sem interação (grant persistido pelo
// devInteractions: lib/actions/interaction.js:151). Também é a única forma de observar que a
// guarda com `hadSession` não faz bounce (se fizesse, o SSO devolveria a /app sem passar por
// "/" — a asserção "URL / com Entrar" pega isso).

test("Sair local seguido de novo Entrar usa SSO no IdP, sem login nem consent", async ({
  page,
}) => {
  let authRequests = 0;
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/o/auth") authRequests += 1;
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Entrar" }).click();
  await login(page, "fake-user-1");
  await page.waitForURL((url) => url.pathname === "/app");

  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();

  const pathsAposSair: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      pathsAposSair.push(new URL(frame.url()).pathname);
    }
  });

  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => url.pathname === "/app");

  // SSO: nenhuma navegação para a tela de login/consent do fake (rotas /o/interaction/*)
  expect(pathsAposSair.some((path) => path.includes("/interaction"))).toBe(false);

  await expect(claimsSection(page, "id_token")).toBeVisible();
  await expect(claimsSection(page, "userinfo")).toBeVisible();

  expect(authRequests).toBe(2);
});
