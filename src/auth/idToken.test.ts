import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalJWKSet,
  errors,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTVerifyGetKey,
} from "jose";

// Ambiente node (default do vite.config.ts): idToken.ts não toca DOM. `jose` real de ponta a
// ponta — só o mock é ../config (o módulo importa no topo) e, no T-07, um `getKey` estubado.
// Sem rede: chaves e tokens são gerados na hora (`generateKeyPair`, `SignJWT`).

const fakeConfig = {
  oidc: {
    issuer: "http://idp.test/o",
    clientId: "spa-test",
    redirectUri: "http://app.test/callback",
    scope: "openid profile email",
  },
};

beforeEach(() => {
  vi.resetModules();
  vi.doMock("../config", () => ({ config: fakeConfig }));
});

async function importVerifyIdToken() {
  const { verifyIdToken } = await import("./idToken");
  return verifyIdToken;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Par de chaves RS256 + JWKS local com um único `kid` — cobre a maioria dos casos. */
async function makeKeys(kid = "k1") {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" };
  const getKey = createLocalJWKSet({ keys: [jwk] });
  return { privateKey, getKey };
}

interface SignOpts {
  kid?: string;
  issuer?: string;
  audience?: string;
  exp?: number; // segundos desde epoch; omitido = sem claim `exp` (T-01.iii)
}

/** Token assinado com claims de identidade fixas (T-01..T-05); nonce e sub ficam a cargo da lib (I4). */
async function sign(privateKey: CryptoKey, opts: SignOpts = {}) {
  let builder = new SignJWT({ sub: "u1", name: "Ana", email: "ana@example.com", nonce: "n" })
    .setProtectedHeader({ alg: "RS256", kid: opts.kid ?? "k1" })
    .setIssuer(opts.issuer ?? "http://idp.test/o")
    .setAudience(opts.audience ?? "spa-test")
    .setIssuedAt();
  if (opts.exp !== undefined) builder = builder.setExpirationTime(opts.exp);
  return builder.sign(privateKey);
}

/** Troca um caractere do segmento do meio (payload) para invalidar a assinatura sem alterar tamanho. */
function tamperPayload(token: string): string {
  const [header, payload, signature] = token.split(".");
  const replacement = payload?.[0] === "A" ? "B" : "A";
  return `${header}.${replacement}${payload?.slice(1)}.${signature}`;
}

describe("verifyIdToken — caminho feliz e requiredClaims (T-01, AC-07)", () => {
  it("(a) exp no futuro: resolve", async () => {
    const { privateKey, getKey } = await makeKeys();
    const token = await sign(privateKey, { exp: nowSeconds() + 3600 });

    const verifyIdToken = await importVerifyIdToken();

    await expect(verifyIdToken(token, getKey)).resolves.toBeUndefined();
  });

  it("(b) exp no passado mas dentro da tolerância de relógio (60s): resolve", async () => {
    const { privateKey, getKey } = await makeKeys();
    const token = await sign(privateKey, { exp: nowSeconds() - 30 });

    const verifyIdToken = await importVerifyIdToken();

    await expect(verifyIdToken(token, getKey)).resolves.toBeUndefined();
  });

  it("(c) token sem exp: rejeita JWTClaimValidationFailed com claim 'exp' (requiredClaims)", async () => {
    const { privateKey, getKey } = await makeKeys();
    const token = await sign(privateKey); // sem setExpirationTime

    const verifyIdToken = await importVerifyIdToken();
    const error = await verifyIdToken(token, getKey).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(errors.JWTClaimValidationFailed);
    expect((error as errors.JWTClaimValidationFailed).claim).toBe("exp");
  });
});

describe("verifyIdToken — assinatura e kid (T-02, AC-02)", () => {
  it("(a) um caractere do payload trocado: JWSSignatureVerificationFailed", async () => {
    const { privateKey, getKey } = await makeKeys();
    const token = tamperPayload(await sign(privateKey, { exp: nowSeconds() + 3600 }));

    const verifyIdToken = await importVerifyIdToken();

    await expect(verifyIdToken(token, getKey)).rejects.toBeInstanceOf(
      errors.JWSSignatureVerificationFailed,
    );
  });

  it("(b) assinado por outro par de chaves com o mesmo kid: JWSSignatureVerificationFailed", async () => {
    const { getKey } = await makeKeys("k1"); // JWKS confia só na chave pública deste par
    const { privateKey: otherPrivateKey } = await generateKeyPair("RS256"); // par diferente
    const token = await sign(otherPrivateKey, { kid: "k1", exp: nowSeconds() + 3600 });

    const verifyIdToken = await importVerifyIdToken();

    await expect(verifyIdToken(token, getKey)).rejects.toBeInstanceOf(
      errors.JWSSignatureVerificationFailed,
    );
  });

  it("(c) chave certa mas kid do header desconhecido no JWKS: JWKSNoMatchingKey", async () => {
    const { privateKey, getKey } = await makeKeys("k1");
    const token = await sign(privateKey, { kid: "k2", exp: nowSeconds() + 3600 });

    const verifyIdToken = await importVerifyIdToken();

    await expect(verifyIdToken(token, getKey)).rejects.toBeInstanceOf(errors.JWKSNoMatchingKey);
  });
});

describe("verifyIdToken — issuer (T-03, AC-03, AC-04)", () => {
  it("(a) iss do token diferente do configurado: JWTClaimValidationFailed claim 'iss'", async () => {
    const { privateKey, getKey } = await makeKeys();
    const token = await sign(privateKey, {
      issuer: "http://outro.test/o",
      exp: nowSeconds() + 3600,
    });

    const verifyIdToken = await importVerifyIdToken();
    const error = await verifyIdToken(token, getKey).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(errors.JWTClaimValidationFailed);
    expect((error as errors.JWTClaimValidationFailed).claim).toBe("iss");
  });

  it("(b) issuer configurado com barra final não bate com iss sem barra: igualdade exata, não normalizada (AC-04)", async () => {
    vi.resetModules();
    vi.doMock("../config", () => ({
      config: { ...fakeConfig, oidc: { ...fakeConfig.oidc, issuer: "http://idp.test/o/" } },
    }));
    const { privateKey, getKey } = await makeKeys();
    const token = await sign(privateKey, { issuer: "http://idp.test/o", exp: nowSeconds() + 3600 });

    const { verifyIdToken } = await import("./idToken");
    const error = await verifyIdToken(token, getKey).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(errors.JWTClaimValidationFailed);
    expect((error as errors.JWTClaimValidationFailed).claim).toBe("iss");
  });
});

describe("verifyIdToken — audience (T-04, AC-05)", () => {
  it("(a) aud diferente do clientId configurado: JWTClaimValidationFailed claim 'aud'", async () => {
    const { privateKey, getKey } = await makeKeys();
    const token = await sign(privateKey, { audience: "outro-client", exp: nowSeconds() + 3600 });

    const verifyIdToken = await importVerifyIdToken();
    const error = await verifyIdToken(token, getKey).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(errors.JWTClaimValidationFailed);
    expect((error as errors.JWTClaimValidationFailed).claim).toBe("aud");
  });
});

describe("verifyIdToken — expiração fora da tolerância (T-05, AC-06)", () => {
  it("(a) exp 120s no passado: JWTExpired", async () => {
    const { privateKey, getKey } = await makeKeys();
    const token = await sign(privateKey, { exp: nowSeconds() - 120 });

    const verifyIdToken = await importVerifyIdToken();

    await expect(verifyIdToken(token, getKey)).rejects.toBeInstanceOf(errors.JWTExpired);
  });
});

describe("verifyIdToken — algoritmo restrito a RS256 (T-06, AC-08)", () => {
  it("(a) token HS256: JOSEAlgNotAllowed", async () => {
    const secret = new TextEncoder().encode("segredo");
    const token = await new SignJWT({
      sub: "u1",
      name: "Ana",
      email: "ana@example.com",
      nonce: "n",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("http://idp.test/o")
      .setAudience("spa-test")
      .setIssuedAt()
      .setExpirationTime(nowSeconds() + 3600)
      .sign(secret);
    const { getKey } = await makeKeys();

    const verifyIdToken = await importVerifyIdToken();

    await expect(verifyIdToken(token, getKey)).rejects.toBeInstanceOf(errors.JOSEAlgNotAllowed);
  });

  it("(b) alg 'none' montado à mão (sem assinatura): JOSEAlgNotAllowed", async () => {
    // btoa (não Buffer): o tsconfig do src não carrega tipos de node.
    const base64url = (value: string) =>
      btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const header = base64url(JSON.stringify({ alg: "none" }));
    const payload = base64url(
      JSON.stringify({
        sub: "u1",
        iss: "http://idp.test/o",
        aud: "spa-test",
        exp: nowSeconds() + 3600,
      }),
    );
    const token = `${header}.${payload}.`;
    const { getKey } = await makeKeys();

    const verifyIdToken = await importVerifyIdToken();

    await expect(verifyIdToken(token, getKey)).rejects.toBeInstanceOf(errors.JOSEAlgNotAllowed);
  });
});

describe("verifyIdToken — falha ao obter a chave (T-07, AC-09)", () => {
  it("(a) getKey rejeita: verifyIdToken propaga o MESMO erro (identidade, não instância nova)", async () => {
    const { privateKey } = await makeKeys();
    const token = await sign(privateKey, { exp: nowSeconds() + 3600 });
    const err = new TypeError("Failed to fetch");
    const getKey: JWTVerifyGetKey = async () => {
      throw err;
    };

    const verifyIdToken = await importVerifyIdToken();

    await expect(verifyIdToken(token, getKey)).rejects.toBe(err);
  });
});
