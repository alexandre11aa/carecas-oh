// src/client/screens/loadingScreen.ts
import { getState } from "../state.js";
import { el, type Screen } from "./dom.js";

/** Exibida no primeiro acesso, quando o servidor gratuito pode estar acordando. */
export const createLoadingScreen = (): Screen => {
  const element = el("main", "screen themed");
  const text = el("p", "hint");
  element.append(el("h1", "game-title", "Carecas-Oh"), el("div", "spinner"), text);

  const update = () => {
    const { booting, connection } = getState();
    text.textContent =
      connection === "offline"
        ? "Sem conexão com o servidor. Tentando reconectar..."
        : booting
          ? "Conectando ao servidor... Se ele estava hibernando, isso pode levar cerca de um minuto."
          : "Carregando imagens...";
  };
  update();
  return { element, update };
};
