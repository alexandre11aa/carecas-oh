// src/client/scene/texturePaths.test.ts
import { describe, expect, it } from "vitest";
import { createMatch } from "../../engine/createMatch.js";
import { playerView } from "../../engine/playerView.js";
import {
  BACKGROUND_PATH,
  CARD_BACK_PATH,
  criticalTextureUrls,
  fitTextureSize,
  TABLE_MAX_TEXTURE_WIDTH,
  TABLE_PATH,
  textureOptionsFor,
} from "./texturePaths.js";

describe("texturePaths", () => {
  it("expoe_os_caminhos_centrais", () => {
    expect(CARD_BACK_PATH).toBe("/cards/verso.webp");
    expect(BACKGROUND_PATH).toBe("/textures/background.png");
    expect(TABLE_PATH).toBe("/textures/table.png");
  });

  it("reduz_1030x1500_para_largura_512_mantendo_proporcao", () => {
    expect(fitTextureSize(1030, 1500, 512)).toEqual({ width: 512, height: 746 });
  });

  it("reduz_para_1024", () => {
    expect(fitTextureSize(1030, 1500, 1024)).toEqual({ width: 1024, height: 1491 });
  });

  it("nao_amplia_imagem_menor_que_o_limite", () => {
    expect(fitTextureSize(256, 372, 512)).toEqual({ width: 256, height: 372 });
  });

  it("usa_limite_padrao_quando_omitido", () => {
    expect(fitTextureSize(2000, 1000)).toEqual({ width: 512, height: 256 });
  });

  it("entrada_invalida_devolve_1x1", () => {
    expect(fitTextureSize(0, 100, 512)).toEqual({ width: 1, height: 1 });
    expect(fitTextureSize(100, 100, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe("texturas criticas do estado inicial", () => {
  const field = { position: "ATTACK" as const, summonedOnTurn: 1, hasAttacked: false, changedPositionOnTurn: null };

  it("sem_partida_so_fundo_mesa_e_verso", () => {
    expect(criticalTextureUrls(null)).toEqual([BACKGROUND_PATH, TABLE_PATH, CARD_BACK_PATH]);
  });

  it("inclui_mao_e_campo_do_jogador_sem_repetir_e_ignora_cartas_viradas_cemiterio_e_oponente", () => {
    const state = createMatch(123, { P1: "balanced", P2: "strategic" });
    state.players.P1.hand = ["ash_sprite", "ash_sprite", "fire_bolt"];
    state.players.P1.monsters[0] = { cardId: "moss_golem", faceDown: false, ...field };
    state.players.P1.monsters[1] = { cardId: "tide_imp", faceDown: true, ...field };
    state.players.P1.spellTraps[0] = { cardId: "spike_pit", faceDown: false, setOnTurn: 1 };
    state.players.P1.spellTraps[1] = { cardId: "dark_veil", faceDown: true, setOnTurn: 1 };
    state.players.P1.graveyard = ["bone_knight"];
    state.players.P2.monsters[0] = { cardId: "crystal_bat", faceDown: false, ...field };
    state.players.P2.hand = ["wind_gust"];
    expect(criticalTextureUrls(playerView(state, "P1"))).toEqual([
      BACKGROUND_PATH,
      TABLE_PATH,
      CARD_BACK_PATH,
      "/cards/o_bixo_do_dedo_torado.webp",
      "/cards/pensamento_negativo.webp",
      "/cards/peido_fatal.webp",
      "/cards/reversao_de_acusacao_absurda.webp",
    ]);
  });

  it("a_mesa_tem_opcoes_proprias_e_as_demais_usam_o_padrao", () => {
    expect(textureOptionsFor(TABLE_PATH)).toEqual({ maxWidth: TABLE_MAX_TEXTURE_WIDTH, anisotropy: 8 });
    expect(textureOptionsFor(CARD_BACK_PATH)).toEqual({});
  });
});
