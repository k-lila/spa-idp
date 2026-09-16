import type { Locator, Page } from "@playwright/test";

/**
 * Login no IdP fake (devInteractions do oidc-provider): tela de login (qualquer senha) seguida
 * de consent. Assume que a navegação para o IdP já foi iniciada (signinRedirect / SSO real).
 * `node_modules/oidc-provider/lib/views/login.js:14-26`, `interaction.js:81`.
 */
export async function login(page: Page, user: string): Promise<void> {
  await page.locator('input[name="login"]').waitFor();
  await page.fill('input[name="login"]', user);
  await page.fill('input[name="password"]', "qualquer-senha");
  await page.click('button:has-text("Sign-in")');

  await page.click('button:has-text("Continue")');
}

/** Section (com `<h2>`) que exibe as claims de `heading` ("id_token" ou "userinfo") em /app. */
export function claimsSection(page: Page, heading: string): Locator {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: heading }) });
}
