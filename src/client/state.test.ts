// src/client/state.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "../engine/createMatch.js";
import { playerView } from "../engine/playerView.js";
import { lobbyRoomsFromPayload, matchForRoom, roomPage, type PublicRoom } from "./state.js";

const room = (hasMatch: boolean, ready: boolean[] = []): PublicRoom => ({
  code: "ABCD",
  hasMatch,
  players: ready.map((r, i) => ({ nickname: `J${i}`, connected: true, ready: r })),
});
const view = playerView(createMatch(123, { P1: "balanced", P2: "strategic" }), "P1");

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

describe("lobbyRoomsFromPayload", () => {
  it("converte_a_lista_de_salas_do_payload", () => {
    expect(lobbyRoomsFromPayload({ rooms: [{ code: "X7K2", hostNickname: "Ana" }] })).toEqual([
      { code: "X7K2", hostNickname: "Ana" },
    ]);
  });

  it("devolve_lista_vazia_quando_nao_ha_salas", () => {
    expect(lobbyRoomsFromPayload({ rooms: [] })).toEqual([]);
  });

  it("descarta_itens_malformados_e_ignora_campos_extras", () => {
    const payload = { rooms: [{ code: "AAAA" }, null, { code: 1, hostNickname: "x" }, { code: "BBBB", hostNickname: "Bia", token: "t" }] };
    expect(lobbyRoomsFromPayload(payload)).toEqual([{ code: "BBBB", hostNickname: "Bia" }]);
  });

  it("devolve_lista_vazia_para_payload_invalido", () => {
    expect(lobbyRoomsFromPayload(null)).toEqual([]);
    expect(lobbyRoomsFromPayload({ rooms: "x" })).toEqual([]);
  });
});

describe("roomPage", () => {
  it("abre_a_mesa_quando_ha_partida", () => {
    expect(roomPage(room(true), view)).toBe("match");
    expect(roomPage({ ...room(true), vsAi: true, aiLevel: "easy" }, view)).toBe("match");
  });

  it("mostra_a_sala_de_espera_numa_sala_comum_sem_partida", () => {
    expect(roomPage(room(false, [false]), null)).toBe("waiting");
  });

  it("sala_contra_a_ia_sem_partida_ainda_nao_mostra_a_sala_de_espera", () => {
    expect(roomPage({ ...room(true), vsAi: true, aiLevel: "hard" }, null)).toBe("starting");
  });
});
