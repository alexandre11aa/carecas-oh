// src/client/screens/scrollButton.test.ts
import { describe, expect, it } from "vitest";
import { pickScrollTarget, scrollLabel } from "./scrollButton.js";

describe("pickScrollTarget", () => {
  it("no_topo_o_alvo_e_o_fim", () => {
    expect(pickScrollTarget({ scrollTop: 0, viewportHeight: 800, scrollHeight: 3000 })).toBe("bottom");
  });

  it("antes_do_meio_o_alvo_e_o_fim", () => {
    expect(pickScrollTarget({ scrollTop: 1000, viewportHeight: 800, scrollHeight: 3000 })).toBe("bottom");
  });

  it("exatamente_no_meio_o_alvo_e_o_topo", () => {
    expect(pickScrollTarget({ scrollTop: 1100, viewportHeight: 800, scrollHeight: 3000 })).toBe("top");
  });

  it("depois_do_meio_o_alvo_e_o_topo", () => {
    expect(pickScrollTarget({ scrollTop: 1500, viewportHeight: 800, scrollHeight: 3000 })).toBe("top");
  });

  it("perto_do_fim_com_tolerancia_de_poucos_pixels_o_alvo_e_o_topo", () => {
    expect(pickScrollTarget({ scrollTop: 2197, viewportHeight: 800, scrollHeight: 3000 })).toBe("top");
    expect(pickScrollTarget({ scrollTop: 2200, viewportHeight: 800, scrollHeight: 3000 })).toBe("top");
  });

  it("pagina_sem_rolagem_nao_tem_alvo", () => {
    expect(pickScrollTarget({ scrollTop: 0, viewportHeight: 800, scrollHeight: 800 })).toBeNull();
    expect(pickScrollTarget({ scrollTop: 0, viewportHeight: 800, scrollHeight: 600 })).toBeNull();
  });

  it("pagina_curta_dentro_da_tolerancia_nao_tem_alvo", () => {
    expect(pickScrollTarget({ scrollTop: 0, viewportHeight: 800, scrollHeight: 804 })).toBeNull();
  });

  it("pagina_logo_acima_da_tolerancia_passa_a_ter_alvo", () => {
    expect(pickScrollTarget({ scrollTop: 0, viewportHeight: 800, scrollHeight: 805 })).toBe("bottom");
  });
});

describe("scrollLabel", () => {
  it("rotulos_em_portugues", () => {
    expect(scrollLabel("bottom")).toBe("Ir para o fim da página");
    expect(scrollLabel("top")).toBe("Voltar ao topo da página");
  });
});
