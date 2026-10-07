import { expect, type Locator, test } from "@playwright/test";
import { claimsSection, login } from "./idp";

// Único teste que prova discovery real, PKCE S256, troca de code no /o/token com CORS por
// client, id_token RS256 real com nonce conferido, e userinfo real com Bearer — tudo isso está
// mockado na unidade.

// allTextContents não espera; é seguro aqui só porque o toHaveCount(3) da seção userinfo,
// chamado antes desta função, já implica a área montada — essa ordem é load-bearing.
async function readClaims(section: Locator): Promise<{ sub: string; name: string; email: string }> {
  const [sub, name, email] = await section.locator("dd").allTextContents();
  return { sub: sub ?? "", name: name ?? "", email: email ?? "" };
}

test("login completo com fake-user-1 chega a /app com id_token e userinfo iguais", async ({
  page,
}) => {
  // Prova, por evento de rede/navegação (não por leitura de código), que o /o/jwks da descoberta
  // é buscado antes da navegação a /app — ou seja, que a verificação do id_token (ADR 0013) roda
  // de fato no caminho feliz, e não depois que a SPA já decidiu que a sessão é válida.
  const events: string[] = [];
  page.on("request", (req) => events.push(`req:${new URL(req.url()).pathname}`));
  // Só GET: o preflight (OPTIONS) de /api/conta/ responderia antes e esvaziaria a prova de T-06.
  page.on("response", (res) => {
    if (res.request().method() === "GET") events.push(`res:${new URL(res.url()).pathname}`);
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) events.push(`nav:${new URL(frame.url()).pathname}`);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Entrar" }).click();

  await login(page, "fake-user-1");

  await page.waitForURL((url) => url.pathname === "/app");
  expect(page.url()).toBe("http://localhost:5173/app");

  const idTokenSection = claimsSection(page, "id_token");
  const userinfoSection = claimsSection(page, "userinfo");
  await expect(userinfoSection.locator("dd")).toHaveCount(3);

  const idClaims = await readClaims(idTokenSection);
  const userinfoClaims = await readClaims(userinfoSection);

  const expected = { sub: "fake-user-1", name: "Usuária de Teste", email: "teste@example.com" };
  expect(idClaims).toEqual(expected);
  expect(userinfoClaims).toEqual(expected);

  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();

  // Saudação pelo first_name do fake (sem apelido), link para a conta e nenhuma faixa de
  // confirmação: fake-user-1 tem e-mail confirmado.
  await expect(page.getByText("Olá, Usuária!")).toBeVisible();
  await expect(page.getByRole("link", { name: "Minha conta" })).toBeVisible();
  await expect(page.getByText("Confirme seu e-mail")).toHaveCount(0);

  // I3: o estado do redirect (state/nonce/code_verifier) foi consumido e apagado pela lib.
  const storage = await page.evaluate(() => ({
    localLength: localStorage.length,
    sessionKeys: Object.keys(sessionStorage),
  }));
  expect(storage.localLength).toBe(0);
  expect(storage.sessionKeys.some((key) => key.startsWith("oidc."))).toBe(false);

  // T-10 (AC-01): /o/jwks é a rota default do oidc-provider sob /o (prática do /o/me em T-05).
  const jwksIndex = events.indexOf("req:/o/jwks");
  const appNavIndex = events.indexOf("nav:/app");
  expect(jwksIndex).toBeGreaterThanOrEqual(0);
  expect(jwksIndex).toBeLessThan(appNavIndex);

  // T-06: a guarda dos termos busca a conta e recebe a resposta antes de qualquer pedido ao userinfo
  // (/o/me): na montagem, nenhuma outra chamada autenticada corre junto com o GET da conta.
  const contaResIndex = events.indexOf("res:/api/conta/");
  const userinfoReqIndex = events.indexOf("req:/o/me");
  expect(contaResIndex).toBeGreaterThanOrEqual(0);
  expect(userinfoReqIndex).toBeGreaterThanOrEqual(0);
  expect(contaResIndex).toBeLessThan(userinfoReqIndex);
});
