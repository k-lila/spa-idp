import { expect, test } from "@playwright/test";
import { login } from "./idp";

// internalPath e state.returnTo estão cobertos na unidade; só o redirect real prova a ida e
// volta do `state` pelo sessionStorage da lib e pelo parâmetro `state` do IdP real.

test("deep-link com query string preserva path+search e não deixa /callback no histórico", async ({
  page,
}) => {
  await page.goto("/app?x=1");

  await login(page, "fake-user-1");

  await page.waitForURL((url) => url.pathname === "/app" && url.search === "?x=1");
  expect(page.url()).toBe("http://localhost:5173/app?x=1");
  await expect(page.getByRole("heading", { name: "Área autenticada" })).toBeVisible();

  await page.goBack();

  expect(page.url()).not.toContain("/callback");
});
