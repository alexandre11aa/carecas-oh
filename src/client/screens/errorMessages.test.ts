// src/client/screens/errorMessages.test.ts
import { describe, expect, it } from "vitest";
import { errorMessage } from "./errorMessages.js";

describe("errorMessage", () => {
  it("INVALID_PAYLOAD_nao_cita_apelido_nem_codigo", () => {
    expect(errorMessage("INVALID_PAYLOAD")).toBe("Dados inválidos. Confira o que foi informado e tente de novo.");
  });

  it("codigo_desconhecido_usa_mensagem_generica", () => {
    expect(errorMessage("XYZ")).toBe("Algo deu errado. Tente novamente.");
  });
});
