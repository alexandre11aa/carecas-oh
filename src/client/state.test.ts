// src/client/state.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "../engine/createMatch.js";
import { playerView } from "../engine/playerView.js";
import { matchForRoom, type PublicRoom } from "./state.js";

const room = (hasMatch: boolean, ready: boolean[] = []): PublicRoom => ({
  code: "ABCD",
  hasMatch,
  players: ready.map((r, i) => ({ nickname: `J${i}`, connected: true, ready: r })),
});
const view = playerView(createMatch(123), "P1");

describe("matchForRoom", () => {
  it("preserva_a_partida_quando_a_sala_guarda_uma_partida", () => {
    expect(matchForRoom(room(true), view)).toBe(view);
  });

  it("preserva_a_partida_de_quem_fica_apos_OPPONENT_LEFT_mesmo_sem_ninguem_pronto", () => {
    expect(matchForRoom(room(true, [false]), view)).toBe(view);
  });

  it("descarta_a_partida_quando_a_sala_voltou_ao_lobby_sem_partida", () => {
    expect(matchForRoom(room(false, [false, false]), view)).toBeNull();
  });

  it("mantem_null_quando_nao_ha_partida", () => {
    expect(matchForRoom(room(true), null)).toBeNull();
  });
});
