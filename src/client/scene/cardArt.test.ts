// src/client/scene/cardArt.test.ts
import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { CARDS } from "../../engine/cards.js";
import { getDeck } from "../../engine/decks.js";
import { CARD_BACK_PATH } from "./texturePaths.js";
import { chooseFace, faceImageUrl, settleArtPhase, startArtPhase } from "./cardArt.js";

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
  // O deck Agressivo ainda usa PNG provisório sem arquivo (artes pendentes, registrado na issue #301);
  // todas as demais cartas precisam de arquivo em public/cards. Ao entrar as artes dele, remova a exceção.
  it("toda_carta_tem_arquivo_de_imagem_em_public_cards", () => {
    const pendentes = new Set(getDeck("aggressive").cardIds);
    const faltantes = CARDS.filter((card) => !pendentes.has(card.id) && !existsSync(new URL(`../public${card.image}`, import.meta.url))).map((card) => `${card.id} -> ${card.image}`);
    expect(faltantes).toEqual([]);
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

describe("fase da arte da carta", () => {
  it("sem_imagem_mostra_o_texto_direto", () => {
    expect(startArtPhase(null, false)).toBe("none");
  });
  it("imagem_em_cache_aparece_direto_sem_loading", () => {
    expect(startArtPhase("/cards/x.webp", true)).toBe("art");
  });
  it("imagem_nao_carregada_mostra_loading", () => {
    expect(startArtPhase("/cards/x.webp", false)).toBe("loading");
  });
  it("carga_bem_sucedida_vira_arte_e_falha_ou_tempo_viram_texto", () => {
    expect(settleArtPhase("loading", "load")).toBe("art");
    expect(settleArtPhase("loading", "error")).toBe("fallback");
    expect(settleArtPhase("loading", "timeout")).toBe("fallback");
  });
  it("fase_ja_resolvida_nao_muda_com_evento_tardio", () => {
    expect(settleArtPhase("art", "timeout")).toBe("art");
    expect(settleArtPhase("fallback", "load")).toBe("fallback");
  });
});
