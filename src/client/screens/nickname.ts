// src/client/screens/nickname.ts
/** Lógica pura da validação do apelido na tela inicial. */

export const NICKNAME_HINT = "Defina seu apelido para continuar";

/** Criar ou entrar numa sala só é possível com apelido não vazio (após `trim`). */
export const canSubmitNickname = (value: string): boolean => value.trim().length > 0;
