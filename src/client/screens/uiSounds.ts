// src/client/screens/uiSounds.ts
// Lógica pura: qual som de interface tocar para um elemento clicado e em quais páginas há som.
import type { UiSoundName } from "../animations/matchAudio.js";

/** Descrição mínima do elemento interativo clicado (extraída do DOM em `main.ts`). */
export type ClickTarget = {
  tag: string;
  classes: readonly string[];
  disabled: boolean;
  role: string | null;
  inputType: string | null;
};

const INTERACTIVE_TAGS = new Set(["button", "a", "select", "summary"]);
const INTERACTIVE_INPUTS = new Set(["button", "submit", "checkbox", "radio"]);
/** Ações que confirmam (criar, entrar, iniciar, pronto) usam a classe de botão principal. */
const CONFIRM_CLASS = "primary";
/** O botão de som não toca clique: ligar/desligar tem retorno próprio. */
const SILENT_CLASS = "sound-button";

export const isInteractiveTarget = (target: ClickTarget): boolean =>
  INTERACTIVE_TAGS.has(target.tag) || target.role === "button" || (target.tag === "input" && INTERACTIVE_INPUTS.has(target.inputType ?? ""));

export const uiSoundFor = (target: ClickTarget): UiSoundName | null => {
  if (target.disabled || !isInteractiveTarget(target) || target.classes.includes(SILENT_CLASS)) return null;
  return target.classes.includes(CONFIRM_CLASS) ? "confirm" : "click";
};

/** Chaves de página de `main.ts`: `home:*`, `guide`, `cards`, `waiting`, `starting`, `match`. */
export type PageKey = string;

/** Páginas com som, onde aparece o botão de ligar/desligar. */
export const showsSoundButton = (key: PageKey): boolean =>
  key.startsWith("home:") || key === "guide" || key === "cards" || key === "waiting" || key === "match";

/** A partida tem seus próprios sons e o botão no HUD; os cliques de menu valem nas demais páginas com som. */
export const playsUiClicks = (key: PageKey): boolean => showsSoundButton(key) && key !== "match";

/** O botão fixo global some na partida, onde o HUD mostra o mesmo botão. */
export const showsFloatingSoundButton = (key: PageKey): boolean => showsSoundButton(key) && key !== "match";
