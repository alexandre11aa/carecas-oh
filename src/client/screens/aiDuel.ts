// src/client/screens/aiDuel.ts
/** Lógica pura do duelo contra a IA na home: níveis, validação e payload de `room:createAi`. */
import type { DeckId } from "../../engine/decks.js";
import { AI_LEVELS, type AiLevel } from "../../engine/index.js";

export const DEFAULT_AI_LEVEL: AiLevel = "medium";

export const AI_NICKNAME_MAX = 20;

export type AiLevelOption = { id: AiLevel; name: string; description: string };

const LEVEL_TEXTS: Record<AiLevel, { name: string; description: string }> = {
  easy: { name: "Fácil", description: "Joga sem pressa e comete erros. Bom para aprender." },
  medium: { name: "Médio", description: "Joga com bom senso, mas ainda pode ser surpreendida." },
  hard: { name: "Difícil", description: "Calcula as jogadas e aproveita cada brecha." },
};

/** Níveis para exibir, na ordem de `AI_LEVELS`, com nome e descrição curta. */
export const aiLevelOptions = (): AiLevelOption[] => AI_LEVELS.map((id) => ({ id, ...LEVEL_TEXTS[id] }));

/** Valida um valor desconhecido como nível da IA. */
export const asAiLevel = (value: unknown): AiLevel | null => AI_LEVELS.find((level) => level === value) ?? null;

/** Apelido válido para o duelo contra a IA: de 1 a 20 caracteres após `trim`. */
export const isAiNicknameValid = (nickname: string): boolean => {
  const length = nickname.trim().length;
  return length >= 1 && length <= AI_NICKNAME_MAX;
};

/** "Iniciar duelo" exige apelido válido, nível conhecido e deck escolhido. */
export const canStartAiDuel = (input: { nickname: string; level: AiLevel | null; deckId: DeckId | null }): boolean =>
  isAiNicknameValid(input.nickname) && asAiLevel(input.level) !== null && input.deckId !== null;

/** Payload de `room:createAi`; combinação inválida não gera payload. */
export const aiRoomPayload = (input: {
  nickname: string;
  level: AiLevel | null;
  deckId: DeckId | null;
}): { nickname: string; level: AiLevel; deckId: DeckId } | null =>
  input.level && input.deckId && canStartAiDuel(input) ? { nickname: input.nickname.trim(), level: input.level, deckId: input.deckId } : null;
