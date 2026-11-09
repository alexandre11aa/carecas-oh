// src/client/screens/uiSounds.test.ts
import { describe, expect, it } from "vitest";
import { playsUiClicks, showsFloatingSoundButton, showsSoundButton, uiSoundFor, type ClickTarget } from "./uiSounds.js";

const target = (patch: Partial<ClickTarget>): ClickTarget => ({ tag: "button", classes: [], disabled: false, role: null, inputType: null, ...patch });

describe("som de clique da interface", () => {
  it("botao_comum_toca_click", () => {
    expect(uiSoundFor(target({}))).toBe("click");
    expect(uiSoundFor(target({ classes: ["deck-option", "selected"] }))).toBe("click");
  });

  it("botao_principal_toca_confirm", () => {
    expect(uiSoundFor(target({ classes: ["primary"] }))).toBe("confirm");
  });

  it("links_selects_e_role_button_tocam_click", () => {
    expect(uiSoundFor(target({ tag: "a" }))).toBe("click");
    expect(uiSoundFor(target({ tag: "select" }))).toBe("click");
    expect(uiSoundFor(target({ tag: "div", role: "button" }))).toBe("click");
    expect(uiSoundFor(target({ tag: "input", inputType: "checkbox" }))).toBe("click");
  });

  it("campo_de_texto_e_elemento_nao_interativo_ficam_mudos", () => {
    expect(uiSoundFor(target({ tag: "input", inputType: "text" }))).toBeNull();
    expect(uiSoundFor(target({ tag: "div" }))).toBeNull();
  });

  it("botao_desabilitado_e_botao_de_som_ficam_mudos", () => {
    expect(uiSoundFor(target({ disabled: true, classes: ["primary"] }))).toBeNull();
    expect(uiSoundFor(target({ classes: ["sound-button", "sound-floating"] }))).toBeNull();
  });
});

describe("paginas com som", () => {
  it("botao_de_som_aparece_em_home_sala_guia_cartas_e_partida", () => {
    for (const key of ["home:", "home:ABCD", "waiting", "guide", "cards", "match"]) expect(showsSoundButton(key)).toBe(true);
    for (const key of ["starting", ""]) expect(showsSoundButton(key)).toBe(false);
  });

  it("botao_fixo_some_na_partida_para_nao_duplicar_o_do_hud", () => {
    expect(showsFloatingSoundButton("match")).toBe(false);
    expect(showsFloatingSoundButton("guide")).toBe(true);
    expect(showsFloatingSoundButton("waiting")).toBe(true);
  });

  it("cliques_de_menu_tocam_fora_da_partida", () => {
    expect(playsUiClicks("home:")).toBe(true);
    expect(playsUiClicks("cards")).toBe(true);
    expect(playsUiClicks("match")).toBe(false);
    expect(playsUiClicks("starting")).toBe(false);
  });
});
