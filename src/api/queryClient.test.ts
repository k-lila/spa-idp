import { describe, expect, it, vi } from "vitest";

// http.ts importa ../auth/userManager, que importa ../config (lança sem VITE_*). Isola config.
vi.mock("../auth/userManager", () => ({
  userManager: { getUser: vi.fn() },
  signin: vi.fn(),
}));

import { queryClient } from "./queryClient";
import { UnauthorizedError } from "./http";

describe("queryClient", () => {
  it("retry: nunca para UnauthorizedError, 1 vez para os demais erros", () => {
    const retry = queryClient.getDefaultOptions().queries?.retry;

    expect(typeof retry).toBe("function");
    if (typeof retry !== "function") throw new Error("retry não é uma função");

    expect(retry(0, new UnauthorizedError())).toBe(false);
    expect(retry(0, new Error())).toBe(true);
    expect(retry(1, new Error())).toBe(false);
  });
});
