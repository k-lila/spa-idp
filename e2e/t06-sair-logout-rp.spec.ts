import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { claimsSection, login } from "./idp";

// "Sair" é logout iniciado pela RP (ADR 0019): a lib esquece os tokens e navega ao
// `end_session_endpoint` da descoberta, sem `state`. Só o IdP real (o fake) prova que a sessão do
// provedor morre (o "Entrar" seguinte pede senha) e que "Voltar" não devolve claims. O endpoint
// nunca é fixado aqui (I5): o fake o publica em /o/session/end, e o teste o lê da descoberta.

const DISCOVERY = "http://localhost:9000/o/.well-known/openid-configuration";
const SIGNOUT_ALERT = "Não foi possível encerrar a sessão no provedor de identidade.";

async function discovery(request: APIRequestContext): Promise<Record<string, unknown>> {
  const res = await request.get(DISCOVERY);
  expect(res.ok()).toBe(true);
  return (await res.json()) as Record<string, unknown>;
}

async function entrar(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar" }).click();
  await login(page, "fake-user-1");
  await page.waitForURL((url) => url.pathname === "/app");
  await expect(claimsSection(page, "id_token")).toBeVisible();
}

async function oidcKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...Object.keys(sessionStorage), ...Object.keys(localStorage)].filter((key) =>
      key.startsWith("oidc."),
    ),
  );
}

test("Sair navega uma vez ao end_session_endpoint (hint, sem state), volta à landing sem SSO e o novo Entrar pede senha", async ({
  page,
  request,
}) => {
  const endSession = new URL((await discovery(request)).end_session_endpoint as string);

  const endSessionRequests: URL[] = [];
  const authRequests: string[] = [];
  let sawLanding = false;
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (
      req.isNavigationRequest() &&
      url.origin + url.pathname === endSession.origin + endSession.pathname
    ) {
      endSessionRequests.push(url);
    }
    if (url.pathname === "/o/auth" && !sawLanding) authRequests.push(req.url());
  });

  await entrar(page);
  authRequests.length = 0; // só interessa o que acontece depois do clique em Sair

  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL("http://localhost:5173/");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  sawLanding = true;

  expect(endSessionRequests).toHaveLength(1);
  const params = endSessionRequests[0]!.searchParams;
  expect(params.get("id_token_hint") ?? "").not.toBe("");
  expect(params.get("post_logout_redirect_uri")).toBe("http://localhost:5173/");
  expect(params.has("state")).toBe(false);
  expect(authRequests).toEqual([]); // nenhum SSO entre o clique e a landing

  expect(page.url()).toBe("http://localhost:5173/");
  expect(await oidcKeys(page)).toEqual([]);

  // A sessão do IdP morreu: o Entrar seguinte pede credenciais e só volta a /app após o login.
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator('input[name="login"]')).toBeVisible();
  expect(new URL(page.url()).pathname).toContain("/interaction");

  await login(page, "fake-user-1");
  await page.waitForURL((url) => url.pathname === "/app");
  await expect(claimsSection(page, "id_token")).toBeVisible();
});

test('"Voltar" depois de Sair nunca mostra claims e termina na tela de login do IdP', async ({
  page,
}) => {
  await entrar(page);
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL("http://localhost:5173/");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();

  const claimsVisible = async () =>
    (await page.getByText("fake-user-1").count()) +
    (await claimsSection(page, "id_token").count()) +
    (await claimsSection(page, "userinfo").count());

  // Limite de voltas só para o teste não girar sem fim; a saída esperada é a tela de login do IdP.
  for (let i = 0; i < 8; i += 1) {
    await page.goBack();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500); // deixa a guarda/redirects assentarem
    expect(await claimsVisible()).toBe(0);
    const url = new URL(page.url());
    if (url.origin !== "http://localhost:5173" || url.pathname === "/app") break;
  }

  await expect(page.locator('input[name="login"]')).toBeVisible();
  expect(new URL(page.url()).pathname).toContain("/interaction");
  expect(await claimsVisible()).toBe(0);
});

test("descoberta sem end_session_endpoint: Sair volta a / com o alerta e sem chegar ao logout do fake", async ({
  page,
  request,
}) => {
  const original = await discovery(request);
  const { end_session_endpoint: endSessionEndpoint, ...semEndSession } = original;
  const endSession = new URL(endSessionEndpoint as string);

  await page.route("**/.well-known/openid-configuration", (route) =>
    route.fulfill({
      json: semEndSession,
      headers: { "access-control-allow-origin": "http://localhost:5173" },
    }),
  );
  const logoutRequests: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith(endSession.pathname)) logoutRequests.push(req.url());
  });

  await entrar(page);
  await page.getByRole("button", { name: "Sair" }).click();

  await page.waitForURL("http://localhost:5173/");
  await expect(page.getByRole("alert")).toHaveText(SIGNOUT_ALERT);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  expect(logoutRequests).toEqual([]);
});
