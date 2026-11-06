// src/engine/index.test.ts
import { describe, expect, it } from "vitest";
import { ENGINE_READY } from "./index";

describe("engine", () => {
  it("expoe_o_modulo_minimo", () => {
    expect(ENGINE_READY).toBe(true);
  });
});
