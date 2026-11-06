// src/client/screens/homeScreen.ts
import { createRoom, joinRoom } from "../network/socket.js";
import { getState, loadNickname, saveNickname } from "../state.js";
import { el, type Screen } from "./dom.js";
import { errorMessage } from "./errorMessages.js";
import { NICKNAME_HINT, canSubmitNickname } from "./nickname.js";

/** Tela inicial. Com `presetCode` (rota /sala/CODIGO) mostra só a entrada na sala indicada. */
export const createHomeScreen = (presetCode: string | null): Screen => {
  const element = el("main", "screen");
  element.append(
    el("h1", undefined, "Carecas Oh"),
    el("p", "hint", presetCode ? `Você foi convidado para a sala ${presetCode}.` : "Duelo de cartas 1x1. Sem cadastro."),
  );

  const nicknameInput = el("input");
  nicknameInput.placeholder = "Seu apelido";
  nicknameInput.maxLength = 20;
  nicknameInput.value = loadNickname();
  nicknameInput.setAttribute("aria-label", "Apelido");

  const codeInput = el("input");
  codeInput.placeholder = "Código da sala";
  codeInput.maxLength = 4;
  codeInput.setAttribute("aria-label", "Código da sala");

  const nicknameHint = el("p", "hint", NICKNAME_HINT);

  const createButton =el("button", "primary", "Criar sala");
  const joinButton = el("button", undefined, presetCode ? `Entrar na sala ${presetCode}` : "Entrar");
  const error = el("p", "error");
  error.setAttribute("role", "alert");

  const readNickname = (): string | null => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      error.textContent = "Informe um apelido.";
      nicknameInput.focus();
      return null;
    }
    saveNickname(nickname);
    return nickname;
  };

  const submitCreate = () => {
    const nickname = readNickname();
    if (nickname) createRoom(nickname);
  };

  const submitJoin = () => {
    const nickname = readNickname();
    if (!nickname) return;
    const code = (presetCode ?? codeInput.value).trim().toUpperCase();
    if (!code) {
      error.textContent = "Informe o código da sala.";
      codeInput.focus();
      return;
    }
    joinRoom(code, nickname);
  };

  createButton.addEventListener("click", submitCreate);
  joinButton.addEventListener("click", submitJoin);
  nicknameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") (presetCode ? submitJoin : submitCreate)();
  });
  codeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitJoin();
  });

  element.append(nicknameInput, nicknameHint);
  if (presetCode) {
    element.append(joinButton);
  } else {
    element.append(createButton, el("p", "hint", "ou entre com um código"), codeInput, joinButton);
  }
  element.append(error);

  const update = () => {
    const { busy, errorCode } = getState();
    const nicknameOk = canSubmitNickname(nicknameInput.value);
    createButton.disabled = busy || !nicknameOk;
    joinButton.disabled = busy || !nicknameOk;
    nicknameHint.hidden = nicknameOk;
    if (errorCode) error.textContent = errorMessage(errorCode);
    else if (busy) error.textContent = "";
  };
  nicknameInput.addEventListener("input", update);
  update();
  return { element, update };
};
