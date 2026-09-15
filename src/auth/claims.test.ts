import { describe, expect, it } from "vitest";
import { claimsSchema } from "./claims";

describe("claimsSchema", () => {
  it("aceita sub, name, email válidos e expõe só essas 3 chaves", () => {
    const result = claimsSchema.safeParse({ sub: "u1", name: "Ana", email: "ana@example.com" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).toEqual(["sub", "name", "email"]);
    }
  });

  it("aceita claims extras (iat, exp, auth_time, sid, at_hash, chave desconhecida) e as descarta", () => {
    const result = claimsSchema.safeParse({
      sub: "u1",
      name: "Ana",
      email: "ana@example.com",
      iat: 1700000000,
      exp: 1700003600,
      auth_time: 1700000000,
      sid: "session-1",
      at_hash: "hash",
      chave_desconhecida: "x",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).toEqual(["sub", "name", "email"]);
    }
  });

  it("rejeita quando falta name, apontando o path", () => {
    const result = claimsSchema.safeParse({ sub: "u1", email: "ana@example.com" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["name"]);
    }
  });

  it("rejeita quando falta email, apontando o path", () => {
    const result = claimsSchema.safeParse({ sub: "u1", name: "Ana" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"]);
    }
  });

  it.each(["sub", "email"] as const)("rejeita %s vazio com too_small", (field) => {
    const base = { sub: "u1", name: "Ana", email: "ana@example.com" };
    const result = claimsSchema.safeParse({ ...base, [field]: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe("too_small");
      expect(result.error.issues[0]?.path).toEqual([field]);
    }
  });

  it("aceita name vazio", () => {
    const result = claimsSchema.safeParse({ sub: "u1", name: "", email: "ana@example.com" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("");
    }
  });

  it.each([
    ["número", 42],
    ["null", null],
    ["array", [1, 2, 3]],
  ] as const)("rejeita input %s com invalid_type", (_label, input) => {
    const result = claimsSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe("invalid_type");
    }
  });

  it("rejeita input undefined", () => {
    const result = claimsSchema.safeParse(undefined);

    expect(result.success).toBe(false);
  });

  it("rejeita input null", () => {
    const result = claimsSchema.safeParse(null);

    expect(result.success).toBe(false);
  });
});
