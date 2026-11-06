// src/client/screens/tutorialSections.test.ts
import { describe, expect, it } from "vitest";
import {
  TUTORIAL_SECTIONS,
  isTutorialVisible,
  pickActiveSection,
  sectionElementId,
  sectionHref,
} from "./tutorialSections.js";

describe("TUTORIAL_SECTIONS", () => {
  it("tem_ids_unicos_e_titulos_preenchidos", () => {
    const ids = TUTORIAL_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TUTORIAL_SECTIONS.length).toBeGreaterThan(0);
    for (const section of TUTORIAL_SECTIONS) {
      expect(section.title).not.toBe("");
      expect(section.summary).not.toBe("");
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
    expect(pickActiveSection(TUTORIAL_SECTIONS, new Set(["combate", "turno"]), null)).toBe("turno");
  });
  it("mantem_a_atual_quando_nenhuma_esta_visivel", () => {
    expect(pickActiveSection(TUTORIAL_SECTIONS, new Set(), "monstros")).toBe("monstros");
  });
  it("retorna_null_sem_visiveis_e_sem_atual", () => {
    expect(pickActiveSection(TUTORIAL_SECTIONS, new Set(), null)).toBeNull();
  });
  it("ignora_ids_desconhecidos", () => {
    expect(pickActiveSection(TUTORIAL_SECTIONS, new Set(["x"]), "objetivo")).toBe("objetivo");
  });
});
