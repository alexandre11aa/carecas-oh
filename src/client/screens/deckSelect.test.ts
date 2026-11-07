// src/client/screens/deckSelect.test.ts
import { describe, expect, it } from "vitest";
import { asDeckId, canMarkReady, deckOptions, readyPayload, selectDeck } from "./deckSelect.js";

describe("deckSelect", () => {
  it("lista_os_6_decks_com_id_nome_e_imagem", () => {
    const options = deckOptions();
    expect(options.map((o) => o.id)).toEqual(["aggressive", "defensive", "magic", "control", "balanced", "strategic"]);
    expect(options[0]).toEqual({ id: "aggressive", name: "Agressivo", image: "/decks/aggressive.png", label: "Deck Agressivo" });
    expect(options[5]?.name).toBe("Estratégico");
  });

  it("troca_a_escolha_enquanto_nao_esta_pronto", () => {
    expect(selectDeck(null, "magic", false)).toBe("magic");
    expect(selectDeck("magic", "control", false)).toBe("control");
  });

  it("mantem_a_escolha_depois_de_pronto", () => {
    expect(selectDeck("magic", "control", true)).toBe("magic");
  });

  it("habilita_pronto_so_com_deck_sala_cheia_online_e_nao_pronto", () => {
    const base = { full: true, online: true, deckId: "magic" as const, ready: false };
    expect(canMarkReady(base)).toBe(true);
    expect(canMarkReady({ ...base, deckId: null })).toBe(false);
    expect(canMarkReady({ ...base, full: false })).toBe(false);
    expect(canMarkReady({ ...base, online: false })).toBe(false);
    expect(canMarkReady({ ...base, ready: true })).toBe(false);
  });

  it("monta_o_payload_de_room_ready_com_deckId", () => {
    expect(readyPayload("balanced")).toEqual({ deckId: "balanced" });
    expect(readyPayload(null)).toBeNull();
  });

  it("reconhece_so_ids_de_deck_validos", () => {
    expect(asDeckId("control")).toBe("control");
    expect(asDeckId("outro")).toBeNull();
    expect(asDeckId(null)).toBeNull();
    expect(asDeckId(undefined)).toBeNull();
  });
});
