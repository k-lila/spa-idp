import { useQuery } from "@tanstack/react-query";
import { claimsSchema, type Claims } from "../auth/claims";
import { userManager } from "../auth/userManager";
import { authGet } from "./http";

/**
 * `expectedSub` é o `sub` das claims validadas do id_token: OIDC Core §5.3.2 exige que o userinfo
 * afirme a mesma identidade. Todo desvio (status, JSON, contrato, sub) é falha genérica (ADR 0009).
 */
export async function fetchUserinfo(expectedSub: string): Promise<Claims> {
  const endpoint = await userManager.metadataService.getUserInfoEndpoint(); // I5: vem do discovery
  const res = await authGet(endpoint);
  if (!res.ok) throw new Error(`userinfo respondeu ${res.status}`);
  const claims = claimsSchema.parse(await res.json());
  if (claims.sub !== expectedSub) throw new Error("userinfo: sub divergente do id_token");
  return claims;
}

// `sub` na chave: identidade diferente nunca reaproveita cache.
export function useUserinfo(sub: string) {
  return useQuery({ queryKey: ["userinfo", sub], queryFn: () => fetchUserinfo(sub) });
}
