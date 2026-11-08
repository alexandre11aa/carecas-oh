// src/client/screens/tutorialSections.test.ts
import { describe, expect, it } from "vitest";
import { DECKS } from "../../engine/decks.js";
import { aiLevelOptions } from "./aiDuel.js";
import {
  GUIDE_SECTIONS,
  groupCardsByDeck,
  isScrolledToBottom,
  pickActiveSection,
  sectionIdFromHash,
  sectionElementId,
  sectionHref,
} from "./tutorialSections.js";

describe("GUIDE_SECTIONS", () => {
  it("tem_ids_unicos_e_titulos_preenchidos", () => {
    const ids = GUIDE_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(GUIDE_SECTIONS.length).toBeGreaterThan(0);
    for (const section of GUIDE_SECTIONS) {
      expect(section.title).not.toBe("");
      expect(section.summary).not.toBe("");
      expect(section.details.length).toBeGreaterThan(0);
    }
  });

  it("tem_as_secoes_obrigatorias_na_ordem", () => {
    expect(GUIDE_SECTIONS.map((section) => section.id)).toEqual([
      "objetivo", "decks", "turno", "monstros", "combate", "magias", "armadilhas", "ia", "fim",
    ]);
  });

  it("documenta_o_limite_de_30_segundos_e_a_tabela_de_tributo", () => {
    const turno = GUIDE_SECTIONS.find((s) => s.id === "turno");
    const text = JSON.stringify(turno?.details);
    expect(text).toContain("100 segundos");
    const monstros = GUIDE_SECTIONS.find((s) => s.id === "monstros");
    const table = monstros?.details.find((b) => b.kind === "table");
    expect(table).toMatchObject({ rows: [["1 a 4", "Nenhum"], ["5 a 6", expect.any(String)], ["7 ou mais", expect.any(String)]] });
  });

  it("explica_os_decks_fixos_de_20_cartas_com_copias", () => {
    const decks = GUIDE_SECTIONS.find((s) => s.id === "decks");
    const text = JSON.stringify(decks);
    expect(text).toContain("inclusive na revanche");
    expect(text).toContain("fixos");
    expect(text).toContain("mesmo deck");
    expect(text).toContain("secreta");
    expect(text).toContain("4 cartas aleatórias");
    const table = decks?.details.find((b) => b.kind === "table");
    expect(table).toMatchObject({
      rows: [
        ["Agressivo", "12", "6", "2"], ["Defensivo", "10", "4", "6"], ["Mágico", "8", "10", "2"],
        ["Controle", "8", "6", "6"], ["Equilibrado", "10", "6", "4"], ["Estratégico", "10", "8", "2"],
      ],
    });
    expect(table && "rows" in table ? table.rows.length : 0).toBe(DECKS.length);
    const all = JSON.stringify(GUIDE_SECTIONS);
    expect(text).toContain("20 cartas");
    expect(text).toContain("16 ficam no deck");
    expect(text).toContain("de 1 a 3 vezes");
    expect(all).not.toContain("sorteadas");
    expect(all).not.toContain("10 delas");
  });

  it("descreve_os_alvos_das_magias_de_efeito_novo", () => {
    const magias = JSON.stringify(GUIDE_SECTIONS.find((s) => s.id === "magias")?.details);
    expect(magias).toContain("magia/armadilha do oponente");
    expect(magias).toContain("devolução à mão");
    expect(magias).toContain("cemitério");
  });

  it("explica_o_duelo_contra_a_ia_com_niveis_deck_aleatorio_revanche_e_timer_so_do_humano", () => {
    const ia = GUIDE_SECTIONS.find((s) => s.id === "ia");
    expect(ia?.title).toBe("Duelar com IA");
    const text = JSON.stringify(ia);
    expect(text).toContain("deck aleatório");
    expect(text).toContain("só para você");
    expect(text).toContain("Revanche");
    expect(text).toContain("desistência");
    expect(text).not.toContain("20 cartas");
    const table = ia?.details.find((b) => b.kind === "table");
    expect(table && "rows" in table ? table.rows.map((row) => row[0]) : []).toEqual(["Fácil", "Médio", "Difícil"]);
  });

  it("os_niveis_do_guia_acompanham_os_textos_da_home", () => {
    const table = GUIDE_SECTIONS.find((s) => s.id === "ia")?.details.find((b) => b.kind === "table");
    const rows = table && "rows" in table ? table.rows : [];
    expect(rows).toEqual(aiLevelOptions().map((option) => [option.name, option.description]));
  });

  it("nao_inclui_secao_de_cartas_no_guia", () => {
    expect(GUIDE_SECTIONS.some((s) => s.id === "cartas")).toBe(false);
  });
});

describe("groupCardsByDeck", () => {
  const groups = groupCardsByDeck();

  it("tem_6_grupos_na_ordem_dos_decks_com_10_cartas_distintas_e_20_copias", () => {
    expect(groups.map((g) => g.id)).toEqual(DECKS.map((d) => d.id));
    expect(groups.length).toBe(6);
    for (const group of groups) {
      expect(group.cards.length).toBe(10);
      expect(group.cards.reduce((sum, card) => sum + card.copies, 0)).toBe(20);
      expect(group.image).toBe(`/decks/${group.id}.png`);
    }
  });

  it("cartas_de_cada_grupo_sao_as_do_deck_com_textos_preenchidos", () => {
    for (const group of groups) {
      expect(group.cards.map((c) => c.id)).toEqual(DECKS.find((d) => d.id === group.id)?.entries.map((e) => e.cardId));
      expect(group.cards.map((c) => c.copies)).toEqual(DECKS.find((d) => d.id === group.id)?.entries.map((e) => e.copies));
      for (const card of group.cards) {
        expect(card.effect).not.toBe("");
        expect(card.mechanic).not.toBe("");
      }
    }
  });

  it("catalogo_do_controle_exibe_os_nomes_novos_com_texto_e_arte_proprios", () => {
    const control = groups.find((g) => g.id === "control");
    expect(control?.cards.map((c) => c.name)).toEqual(["Peido Fatal", "É Bala Pra Todo Lado", "O Ataque do Sonâmbulo", "Paidrasto", "Não Sobra Nada", "Ilusão do Sábio Bananão", "Está em 80%", "Esquiva da Glória Divina", "Reversão de Acusação Absurda", "Barreira Emocional de Fumaça"]);
    expect(control?.cards.map((c) => c.id)).toEqual(["moss_golem", "bone_knight", "storm_hawk", "iron_minotaur", "silent_rupture", "power_surge", "wind_gust", "divine_glory_evasion", "spike_pit", "dark_veil"]);
    const old = ["Golem de Musgo", "Cavaleiro de Ossos", "Falcão da Tempestade", "Minotauro de Ferro", "Ruptura Silenciosa", "Surto de Poder", "Rajada de Vento", "Fosso de Espinhos", "Véu Sombrio"];
    const text = JSON.stringify([GUIDE_SECTIONS, groups]);
    for (const name of old) expect(text).not.toContain(name);
  });

  it("composicao_confere_com_o_guia", () => {
    expect(groups.map((g) => [g.composition.monsters, g.composition.spells, g.composition.traps])).toEqual([
      [12, 6, 2],
      [10, 4, 6],
      [8, 10, 2],
      [8, 6, 6],
      [10, 6, 4],
      [10, 8, 2],
    ]);
  });

  it("nao_inclui_cartas_fora_de_decks", () => {
    const inDecks = new Set(DECKS.flatMap((d) => d.cardIds));
    const shown = groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(new Set(shown).size).toBe(shown.length);
    expect(shown.every((id) => inDecks.has(id))).toBe(true);
    expect(shown).not.toContain("abyss_titan");
  });

  it("destaca_a_magia_de_efeito_unico_de_cada_deck", () => {
    expect(groups.map((g) => g.signatureSpell?.id)).toEqual([
      "war_cry",
      "life_wall",
      "call_beyond",
      "silent_rupture",
      "vital_exchange",
      "retreat_plan",
    ]);
    for (const group of groups) {
      expect(group.cards.map((c) => c.id)).toContain(group.signatureSpell?.id);
      expect(group.signatureSpell?.effect).not.toBe("");
    }
  });
});

describe("ancoras", () => {
  it("href_aponta_para_o_id_do_elemento", () => {
    expect(sectionElementId("turno")).toBe("tutorial-turno");
    expect(sectionHref("turno")).toBe("#tutorial-turno");
  });
});

describe("pickActiveSection", () => {
  it("escolhe_a_primeira_visivel_na_ordem_do_tutorial", () => {
    expect(pickActiveSection(GUIDE_SECTIONS, new Set(["combate", "turno"]), null)).toBe("turno");
  });
  it("mantem_a_atual_quando_nenhuma_esta_visivel", () => {
    expect(pickActiveSection(GUIDE_SECTIONS, new Set(), "monstros")).toBe("monstros");
  });
  it("retorna_null_sem_visiveis_e_sem_atual", () => {
    expect(pickActiveSection(GUIDE_SECTIONS, new Set(), null)).toBeNull();
  });
  it("ignora_ids_desconhecidos", () => {
    expect(pickActiveSection(GUIDE_SECTIONS, new Set(["x"]), "objetivo")).toBe("objetivo");
  });
});

describe("pickActiveSection no fim da página e com hash", () => {
  const last = GUIDE_SECTIONS[GUIDE_SECTIONS.length - 1]!.id;

  it("no_fim_da_pagina_ativa_a_ultima_secao_mesmo_com_armadilhas_na_faixa", () => {
    expect(last).toBe("fim");
    expect(pickActiveSection(GUIDE_SECTIONS, new Set(["armadilhas"]), "armadilhas", { atBottom: true })).toBe("fim");
  });

  it("com_hash_e_pagina_sem_rolagem_suficiente_ativa_a_secao_do_hash", () => {
    const hashId = sectionIdFromHash("#tutorial-fim");
    expect(hashId).toBe("fim");
    expect(pickActiveSection(GUIDE_SECTIONS, new Set(["armadilhas"]), "armadilhas", { atBottom: true, hashId })).toBe("fim");
    expect(pickActiveSection(GUIDE_SECTIONS, new Set(["armadilhas"]), null, { atBottom: true, hashId: "armadilhas" })).toBe("armadilhas");
  });

  it("fora_do_fim_mantem_o_comportamento_da_faixa_de_leitura", () => {
    expect(pickActiveSection(GUIDE_SECTIONS, new Set(["combate", "turno"]), null, { atBottom: false, hashId: "fim" })).toBe("turno");
    expect(pickActiveSection(GUIDE_SECTIONS, new Set(), "monstros", { atBottom: false })).toBe("monstros");
  });
});

describe("sectionIdFromHash", () => {
  it("converte_ancora_valida_e_ignora_as_demais", () => {
    expect(sectionIdFromHash("#tutorial-objetivo")).toBe("objetivo");
    expect(sectionIdFromHash("#tutorial-inexistente")).toBeNull();
    expect(sectionIdFromHash("#outra")).toBeNull();
    expect(sectionIdFromHash("")).toBeNull();
  });
});

describe("isScrolledToBottom", () => {
  it("detecta_o_fim_da_rolagem_com_tolerancia", () => {
    expect(isScrolledToBottom({ scrollTop: 1200, viewportHeight: 800, scrollHeight: 2000 })).toBe(true);
    expect(isScrolledToBottom({ scrollTop: 1199.5, viewportHeight: 800, scrollHeight: 2000 })).toBe(true);
    expect(isScrolledToBottom({ scrollTop: 1000, viewportHeight: 800, scrollHeight: 2000 })).toBe(false);
  });
  it("pagina_que_nao_rola_conta_como_fim", () => {
    expect(isScrolledToBottom({ scrollTop: 0, viewportHeight: 800, scrollHeight: 800 })).toBe(true);
  });
});
