// src/client/screens/soundButtonView.ts
// DOM do botão de som (alto-falante), compartilhado pela partida e pelas demais páginas.
import { getAppAudio } from "../animations/matchAudio.js";
import { el } from "./dom.js";

// Ícone próprio e estático: alto-falante com ondas, ou com risco quando silenciado.
const ICON = '<svg viewBox="0 0 24 24" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4Z"/><path class="sound-waves" d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="sound-slash" d="m3 3 18 18"/></svg>';

/** Cria o botão ligado à preferência compartilhada; `refresh` relê o estado (alterado por outra tela). */
export const createSoundButton = (extraClass?: string): { element: HTMLButtonElement; refresh: () => void } => {
  const audio = getAppAudio();
  const button = el("button", extraClass ? `sound-button ${extraClass}` : "sound-button");
  button.type = "button";
  const icon = el("span", "sound-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = ICON;
  button.append(icon);
  const refresh = () => {
    button.setAttribute("aria-pressed", String(audio.isEnabled()));
    button.setAttribute("aria-label", audio.isEnabled() ? "Desativar sons" : "Ativar sons");
    button.title = audio.isEnabled() ? "Som ligado: desativar sons" : "Som desligado: ativar sons";
  };
  button.addEventListener("click", () => { audio.setEnabled(!audio.isEnabled()); refresh(); });
  refresh();
  return { element: button, refresh };
};
