// src/client/scene/cardArt.test.ts
import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { CARDS } from "../../engine/cards.js";
import { getDeck } from "../../engine/decks.js";
import { CARD_BACK_PATH } from "./texturePaths.js";
import { chooseFace, faceImageUrl } from "./cardArt.js";

describe("cardArt", () => {
  it("artes_de_controle_tem_nome_atual_e_webp_pequeno_existente", () => {
    for (const id of new Set(getDeck("control").cardIds)) {
      const card = CARDS.find((entry) => entry.id === id)!;
      const slug = card.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      expect(card.image).toBe(`/cards/${slug}.webp`);
      const optimized = new URL(`../public${card.image}`, import.meta.url);
      expect(existsSync(optimized)).toBe(true);
      expect(statSync(optimized).size).toBeLessThan(600_000);
    }
  });
  it("resolve_a_imagem_de_uma_carta_conhecida", () => {
    const card = CARDS[0]!;
    expect(faceImageUrl(card.id)).toBe(card.image);
  });

  it("nunca_resolve_imagem_para_carta_oculta_ou_desconhecida", () => {
    expect(faceImageUrl(null)).toBeNull();
    expect(faceImageUrl(undefined)).toBeNull();
    expect(faceImageUrl("")).toBeNull();
    expect(faceImageUrl("carta_inexistente")).toBeNull();
  });

  it("usa_fallback_enquanto_carrega_ou_se_nao_existe", () => {
    expect(chooseFace("/cards/x.png", false)).toBe("fallback");
    expect(chooseFace(null, true)).toBe("fallback");
  });

  it("usa_imagem_quando_carregou", () => {
    expect(chooseFace("/cards/x.png", true)).toBe("image");
  });

  it("verso_usa_canvas_ate_o_png_carregar_e_depois_o_png", () => {
    expect(chooseFace(CARD_BACK_PATH, false)).toBe("fallback");
    expect(chooseFace(CARD_BACK_PATH, true)).toBe("image");
  });
});
