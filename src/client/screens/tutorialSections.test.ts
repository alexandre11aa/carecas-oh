// src/client/screens/tutorialSections.test.ts
import { describe, expect, it } from "vitest";
import { CARDS } from "../../engine/cards.js";
import { DECKS } from "../../engine/decks.js";
import {
  GUIDE_SECTIONS,
  groupCardsByType,
  isTutorialVisible,
  pickActiveSection,
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
      "objetivo", "decks", "turno", "monstros", "combate", "magias", "armadilhas", "fim",
    ]);
  });

  it("documenta_o_limite_de_30_segundos_e_a_tabela_de_tributo", () => {
    const turno = GUIDE_SECTIONS.find((s) => s.id === "turno");
    const text = JSON.stringify(turno?.details);
    expect(text).toContain("30 segundos");
    const monstros = GUIDE_SECTIONS.find((s) => s.id === "monstros");
    const table = monstros?.details.find((b) => b.kind === "table");
    expect(table).toMatchObject({ rows: [["1 a 4", "Nenhum"], ["5 a 6", expect.any(String)], ["7 ou mais", expect.any(String)]] });
  });

  it("explica_os_decks_fixos_e_nao_menciona_sorteio_de_20_cartas", () => {
    const decks = GUIDE_SECTIONS.find((s) => s.id === "decks");
    const text = JSON.stringify(decks);
    expect(text).toContain("inclusive na revanche");
    expect(text).toContain("fixos");
    expect(text).toContain("mesmo deck");
    expect(text).toContain("secreta");
    expect(text).toContain("5 cartas aleatórias");
    const table = decks?.details.find((b) => b.kind === "table");
    expect(table).toMatchObject({
      rows: [
        ["Agressivo", "6", "3", "1"], ["Defensivo", "5", "2", "3"], ["Mágico", "4", "5", "1"],
        ["Controle", "4", "3", "3"], ["Equilibrado", "5", "3", "2"], ["Estratégico", "5", "4", "1"],
      ],
    });
    expect(table && "rows" in table ? table.rows.length : 0).toBe(DECKS.length);
    const all = JSON.stringify(GUIDE_SECTIONS);
    expect(all).not.toContain("20 cartas");
    expect(all).not.toContain("sorteadas");
    expect(all).not.toContain("10 delas");
  });

  it("descreve_os_alvos_das_magias_de_efeito_novo", () => {
    const magias = JSON.stringify(GUIDE_SECTIONS.find((s) => s.id === "magias")?.details);
    expect(magias).toContain("magia/armadilha do oponente");
    expect(magias).toContain("devolução à mão");
    expect(magias).toContain("cemitério");
  });

  it("nao_inclui_secao_de_cartas_no_guia", () => {
    expect(GUIDE_SECTIONS.some((s) => s.id === "cartas")).toBe(false);
  });
});

describe("groupCardsByType", () => {
  it("agrupa_todas_as_cartas_sem_duplicar_dados", () => {
    const groups = groupCardsByType();
    expect(groups.map((g) => g.kind)).toEqual(["monster", "spell", "trap"]);
    const ids = groups.flatMap((g) => g.cards.map((c) => c.id));
    const expected = (["MONSTER", "SPELL", "TRAP"] as const).flatMap((type) =>
      CARDS.filter((c) => c.type === type).map((c) => c.id),
    );
    expect(ids).toEqual(expected);
    expect(ids.length).toBe(CARDS.length);
    for (const card of groups.flatMap((g) => g.cards)) {
      expect(card.effect).not.toBe("");
      expect(card.mechanic).not.toBe("");
    }
  });
});

describe("ancoras", () => {
  it("href_aponta_para_o_id_do_elemento", () => {
    expect(sectionElementId("turno")).toBe("tutorial-turno");
    expect(sectionHref("turno")).toBe("#tutorial-turno");
  });
});

describe("isTutorialVisible", () => {
  it("mostra_na_home_geral", () => {
    expect(isTutorialVisible(null)).toBe(true);
  });
  it("oculta_no_convite_de_sala", () => {
    expect(isTutorialVisible("AB12")).toBe(false);
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
