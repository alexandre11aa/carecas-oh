// src/client/screens/musicTrack.ts
// Lógica pura: qual música de fundo toca em cada página (menu, lobby ou nenhuma).
import type { MusicTrack } from "../animations/matchAudio.js";
import type { PageKey } from "./uiSounds.js";

/**
 * Menu (home, guia e cartas), lobby (sala de espera) e batalha têm uma faixa cada. A batalha
 * toca durante a partida e para (com fade) quando ela termina, para não encobrir os sons de
 * vitória e derrota; a revanche zera `matchOver` e a faixa volta. A tela de início do duelo
 * não tem música, e som desligado silencia tudo.
 */
export const musicTrackFor = ({ key, soundEnabled, matchOver = false }: { key: PageKey; soundEnabled: boolean; matchOver?: boolean }): MusicTrack | null => {
  if (!soundEnabled) return null;
  if (key === "match") return matchOver ? null : "battle";
  if (key.startsWith("home:") || key === "guide" || key === "cards") return "menu";
  if (key === "waiting") return "lobby";
  return null;
};
