// src/client/screens/nickname.test.ts
import { describe, expect, it } from "vitest";
import { canSubmitNickname } from "./nickname.js";

describe("canSubmitNickname", () => {
  it("recusa_apelido_vazio", () => {
    expect(canSubmitNickname("")).toBe(false);
  });

  it("recusa_apelido_so_com_espacos", () => {
    expect(canSubmitNickname("   \t ")).toBe(false);
  });

  it("aceita_apelido_com_texto", () => {
    expect(canSubmitNickname("Ana")).toBe(true);
    expect(canSubmitNickname("  Ana  ")).toBe(true);
  });
});
