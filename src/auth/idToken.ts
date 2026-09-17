import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { config } from "../config";

// Único ponto de contato com `jose` (ADR 0013). Verifica o que a `oidc-client-ts` não verifica:
// assinatura, `iss`, `aud`, `alg` e `exp`. `nonce` e `sub` ficam com ela (I4).

// 60 s cobre relógio de dispositivo sem NTP e é desprezível diante da vida do token; não é o
// `clockSkewInSeconds` da lib (300 s), que se aplica ao `expires_at` do access_token.
const CLOCK_TOLERANCE_SECONDS = 60;

/** JWKS do `jwks_uri` da descoberta (I5); recarrega ao ver `kid` desconhecido (rotação de chave). */
export function remoteJwks(jwksUri: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(jwksUri));
}

/**
 * Rejeita com o erro do `jose` se o token não for RS256 assinado por chave do JWKS, ou se `iss`
 * (igualdade exata com `VITE_OIDC_ISSUER` — a configuração é a âncora, não a descoberta),
 * `aud` ou `exp` falharem. O payload é descartado: a identidade continua vindo de
 * `user.profile` + zod (ADR 0007).
 */
export async function verifyIdToken(idToken: string, getKey: JWTVerifyGetKey): Promise<void> {
  await jwtVerify(idToken, getKey, {
    issuer: config.oidc.issuer,
    audience: config.oidc.clientId,
    algorithms: ["RS256"],
    requiredClaims: ["exp"], // `jose` só valida `exp` quando presente
    clockTolerance: CLOCK_TOLERANCE_SECONDS,
  });
}
