// src/client/screens/musicTrack.ts
// Lógica pura: qual música de fundo toca em cada página (menu, lobby ou nenhuma).
import type { MusicTrack } from "../animations/matchAudio.js";
import type { PageKey } from "./uiSounds.js";

/**
 * Menu (home, guia e cartas) e lobby (sala de espera) têm uma faixa cada; a partida e a
 * tela de início do duelo não têm música, e som desligado silencia tudo.
 */
export const musicTrackFor = ({ key, soundEnabled }: { key: PageKey; soundEnabled: boolean }): MusicTrack | null => {
  if (!soundEnabled) return null;
  if (key.startsWith("home:") || key === "guide" || key === "cards") return "menu";
  if (key === "waiting") return "lobby";
  return null;
};
