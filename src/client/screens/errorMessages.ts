// src/client/screens/errorMessages.ts

const MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: "Dados inválidos. Confira o apelido (1 a 20 caracteres) e o código (4 caracteres).",
  ROOM_NOT_FOUND: "Sala não encontrada. Confira o código e tente de novo.",
  ROOM_FULL: "Esta sala já está cheia.",
  INVALID_TOKEN: "Sua sessão expirou. Entre em uma sala novamente.",
};

/** Traduz o `code` de erro do servidor para uma mensagem em português. */
export const errorMessage = (code: string): string => MESSAGES[code] ?? "Algo deu errado. Tente novamente.";
