// src/client/screens/musicTrack.test.ts
import { describe, expect, it } from "vitest";
import { musicTrackFor } from "./musicTrack.js";

describe("música de fundo por página", () => {
  it("home_guia_e_cartas_tocam_a_faixa_de_menu", () => {
    expect(musicTrackFor({ key: "home:", soundEnabled: true })).toBe("menu");
    expect(musicTrackFor({ key: "home:AB12", soundEnabled: true })).toBe("menu");
    expect(musicTrackFor({ key: "guide", soundEnabled: true })).toBe("menu");
    expect(musicTrackFor({ key: "cards", soundEnabled: true })).toBe("menu");
  });

  it("sala_de_espera_toca_a_faixa_de_lobby", () => {
    expect(musicTrackFor({ key: "waiting", soundEnabled: true })).toBe("lobby");
  });

  it("partida_em_andamento_toca_a_faixa_de_batalha", () => {
    expect(musicTrackFor({ key: "match", soundEnabled: true })).toBe("battle");
    expect(musicTrackFor({ key: "match", soundEnabled: true, matchOver: false })).toBe("battle");
  });

  it("fim_de_partida_para_a_batalha_e_a_revanche_a_traz_de_volta", () => {
    expect(musicTrackFor({ key: "match", soundEnabled: true, matchOver: true })).toBeNull();
    expect(musicTrackFor({ key: "match", soundEnabled: true, matchOver: false })).toBe("battle");
  });

  it("inicio_do_duelo_nao_toca_musica", () => {
    expect(musicTrackFor({ key: "starting", soundEnabled: true })).toBeNull();
    expect(musicTrackFor({ key: "", soundEnabled: true })).toBeNull();
  });

  it("som_desligado_silencia_a_batalha", () => {
    expect(musicTrackFor({ key: "match", soundEnabled: false, matchOver: false })).toBeNull();
  });

  it("som_desligado_silencia_todas_as_paginas", () => {
    for (const key of ["home:", "guide", "cards", "waiting", "match"]) {
      expect(musicTrackFor({ key, soundEnabled: false })).toBeNull();
    }
  });
});
