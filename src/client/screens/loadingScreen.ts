// src/client/screens/loadingScreen.ts
import { getState } from "../state.js";
import { el, type Screen } from "./dom.js";

/** Exibida no primeiro acesso, quando o servidor gratuito pode estar acordando. */
export const createLoadingScreen = (): Screen => {
  const element = el("main", "screen");
  const text = el("p", "hint");
  element.append(el("h1", undefined, "Carecas Oh"), el("div", "spinner"), text);

  const update = () => {
    text.textContent =
      getState().connection === "offline"
        ? "Sem conexão com o servidor. Tentando reconectar..."
        : "Conectando ao servidor... Se ele estava hibernando, isso pode levar cerca de um minuto.";
  };
  update();
  return { element, update };
};
