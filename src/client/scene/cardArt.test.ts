// src/client/scene/cardArt.test.ts
import { describe, expect, it } from "vitest";
import { CARDS } from "../../engine/cards.js";
import { CARD_BACK_PATH } from "./texturePaths.js";
import { chooseFace, faceImageUrl } from "./cardArt.js";

describe("cardArt", () => {
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
