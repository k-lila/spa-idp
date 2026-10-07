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

  it("aceita email_verified, nickname (mesmo vazio) e updated_at e preserva as três chaves", () => {
    const result = claimsSchema.safeParse({
      sub: "0b9c6f1e-3a52-4c1e-9d0e-6a7f4f2f9a11",
      name: "Ana",
      email: "ana@example.com",
      email_verified: true,
      nickname: "",
      updated_at: 1700000000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email_verified).toBe(true);
      expect(result.data.nickname).toBe("");
      expect(result.data.updated_at).toBe(1700000000);
    }
  });

  it("aceita sem email_verified, nickname e updated_at e não as inventa", () => {
    const result = claimsSchema.safeParse({ sub: "u1", name: "Ana", email: "ana@example.com" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).toEqual(["sub", "name", "email"]);
    }
  });

  describe.each([
    ["email_verified", "true"],
    ["email_verified", null],
    ["nickname", 42],
    ["nickname", null],
    ["updated_at", "2026-10-06T00:00:00Z"],
    ["updated_at", null],
  ] as const)("%s com valor inesperado (%j)", (field, value) => {
    it("descarta a claim sem recusar o login e preserva sub, name e email", () => {
      const base = { sub: "u1", name: "Ana", email: "ana@example.com" };
      const result = claimsSchema.safeParse({ ...base, [field]: value });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[field]).toBeUndefined();
        expect(result.data.sub).toBe("u1");
        expect(result.data.name).toBe("Ana");
        expect(result.data.email).toBe("ana@example.com");
      }
    });
  });

  it.each([
    ["sub", 42],
    ["name", 42],
    ["email", true],
    ["sub", null],
    ["name", null],
    ["email", null],
  ] as const)("continua recusando %s com tipo errado (%j), apontando o path", (field, value) => {
    const base = { sub: "u1", name: "Ana", email: "ana@example.com" };
    const result = claimsSchema.safeParse({ ...base, [field]: value });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe("invalid_type");
      expect(result.error.issues[0]?.path).toEqual([field]);
    }
  });
});
