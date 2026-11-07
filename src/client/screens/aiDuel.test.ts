// src/client/screens/aiDuel.test.ts
import { describe, expect, it } from "vitest";
import { DEFAULT_AI_LEVEL, aiLevelOptions, aiRoomPayload, asAiLevel, canStartAiDuel, isAiNicknameValid } from "./aiDuel.js";

describe("aiLevelOptions", () => {
  it("lista_os_tres_niveis_em_ordem_com_nome_e_descricao", () => {
    const options = aiLevelOptions();
    expect(options.map((o) => [o.id, o.name])).toEqual([["easy", "Fácil"], ["medium", "Médio"], ["hard", "Difícil"]]);
    expect(options.every((o) => o.description.length > 0)).toBe(true);
  });

  it("nivel_padrao_e_medio", () => {
    expect(DEFAULT_AI_LEVEL).toBe("medium");
  });
});

describe("asAiLevel", () => {
  it("aceita_niveis_conhecidos_e_recusa_o_resto", () => {
    expect(asAiLevel("hard")).toBe("hard");
    expect(asAiLevel("expert")).toBeNull();
    expect(asAiLevel(undefined)).toBeNull();
  });
});

describe("isAiNicknameValid", () => {
  it("exige_de_1_a_20_caracteres_apos_trim", () => {
    expect(isAiNicknameValid("")).toBe(false);
    expect(isAiNicknameValid("   ")).toBe(false);
    expect(isAiNicknameValid("A")).toBe(true);
    expect(isAiNicknameValid("  Ana  ")).toBe(true);
    expect(isAiNicknameValid("a".repeat(20))).toBe(true);
    expect(isAiNicknameValid("a".repeat(21))).toBe(false);
  });
});

describe("canStartAiDuel", () => {
  it("aceita_apelido_nivel_e_deck", () => {
    expect(canStartAiDuel({ nickname: "Ana", level: "easy", deckId: "magic" })).toBe(true);
  });

  it("recusa_sem_deck", () => {
    expect(canStartAiDuel({ nickname: "Ana", level: "medium", deckId: null })).toBe(false);
  });

  it("recusa_sem_nivel", () => {
    expect(canStartAiDuel({ nickname: "Ana", level: null, deckId: "magic" })).toBe(false);
  });

  it("recusa_apelido_invalido", () => {
    expect(canStartAiDuel({ nickname: " ", level: "hard", deckId: "magic" })).toBe(false);
    expect(canStartAiDuel({ nickname: "x".repeat(21), level: "hard", deckId: "magic" })).toBe(false);
  });
});

describe("aiRoomPayload", () => {
  it("monta_o_payload_com_apelido_sem_espacos", () => {
    expect(aiRoomPayload({ nickname: "  Ana ", level: "hard", deckId: "control" })).toEqual({ nickname: "Ana", level: "hard", deckId: "control" });
  });

  it("nao_gera_payload_com_combinacao_invalida", () => {
    expect(aiRoomPayload({ nickname: "Ana", level: "easy", deckId: null })).toBeNull();
    expect(aiRoomPayload({ nickname: "", level: "easy", deckId: "magic" })).toBeNull();
    expect(aiRoomPayload({ nickname: "Ana", level: null, deckId: "magic" })).toBeNull();
  });
});
