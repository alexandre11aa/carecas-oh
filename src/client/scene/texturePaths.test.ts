// src/client/scene/texturePaths.test.ts
import { describe, expect, it } from "vitest";
import { BACKGROUND_PATH, CARD_BACK_PATH, fitTextureSize, TABLE_PATH } from "./texturePaths.js";

describe("texturePaths", () => {
  it("expoe_os_caminhos_centrais", () => {
    expect(CARD_BACK_PATH).toBe("/cards/back.png");
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
