// src/client/screens/homeScreen.ts
import { createAiRoom, createRoom, joinRoom, subscribeLobby, unsubscribeLobby } from "../network/socket.js";
import type { AiLevel } from "../../engine/index.js";
import type { DeckId } from "../../engine/decks.js";
import { getState, loadNickname, saveNickname } from "../state.js";
import { DEFAULT_AI_LEVEL, aiLevelOptions, canStartAiDuel } from "./aiDuel.js";
import { createDeckPicker } from "./deckPicker.js";
import { asDeckId, selectDeck } from "./deckSelect.js";
import { el, type Screen } from "./dom.js";
import { createFooter } from "./footer.js";
import { createHero } from "./hero.js";
import { showErrorMessage } from "./toasts.js";
import { NICKNAME_HINT, canSubmitNickname } from "./nickname.js";

/** Painel temático com título opcional. */
const createPanel = (title: string | null, ...children: HTMLElement[]): HTMLElement => {
  const panel = el("section", "panel");
  if (title) panel.append(el("h2", "panel-title", title));
  panel.append(...children);
  return panel;
};

/** Tela inicial. Com `presetCode` (rota /sala/CODIGO) mostra só a entrada na sala indicada. */
export const createHomeScreen = (presetCode: string | null): Screen => {
  const home = el("div", presetCode ? "home home--invite" : "home home--lobby");
  const element = el("main", "screen");
  home.append(element);
  const hero = createHero("Carecas-Oh", presetCode ? `Você foi convidado para a sala ${presetCode}.` : undefined);
  element.append(hero);

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

  const createButton = el("button", "primary", "Criar duelo");
  const aiButton = el("button", undefined, "Duelar com IA");
  const joinButton = el("button", presetCode ? "primary" : undefined, presetCode ? `Entrar na sala ${presetCode}` : "Entrar");

  const readNickname = (): string | null => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      showErrorMessage("Informe um apelido.");
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
      showErrorMessage("Informe o código da sala.");
      codeInput.focus();
      return;
    }
    joinRoom(code, nickname);
  };

  // Etapa "Duelar com IA": painel na própria home (sem rota), no lugar do bloco Novo duelo / Salas abertas.
  let aiLevel: AiLevel = DEFAULT_AI_LEVEL;
  let aiDeck: DeckId | null = asDeckId(getState().deckId);
  const aiPanel = createPanel("Duelar com IA");
  aiPanel.classList.add("ai-duel");
  aiPanel.hidden = true;
  const levelGroup = el("div", "ai-levels");
  levelGroup.setAttribute("role", "group");
  levelGroup.setAttribute("aria-label", "Nível da IA");
  const levelButtons = new Map<AiLevel, HTMLButtonElement>();
  for (const option of aiLevelOptions()) {
    const button = el("button", "ai-level");
    button.type = "button";
    button.append(el("span", "ai-level-name", option.name), el("span", "ai-level-desc", option.description));
    button.addEventListener("click", () => {
      aiLevel = option.id;
      update();
    });
    levelButtons.set(option.id, button);
    levelGroup.append(button);
  }
  const aiDeckPicker = createDeckPicker("Escolha seu deck", (id) => {
    aiDeck = selectDeck(aiDeck, id, false);
    update();
  });
  const aiStart = el("button", "primary", "Iniciar duelo");
  const aiBack = el("button", undefined, "Voltar");
  const aiActions = el("div", "ai-actions");
  aiActions.append(aiStart, aiBack);
  aiPanel.append(
    el("h3", "ai-subtitle", "Nível da IA"),
    levelGroup,
    el("h3", "ai-subtitle", "Seu deck"),
    aiDeckPicker.element,
    el("p", "hint", "A IA joga com um deck sorteado."),
    aiActions,
  );
  let lobbyBlock: HTMLElement | null = null;
  const showAiStep = (open: boolean) => {
    aiPanel.hidden = !open;
    if (lobbyBlock) lobbyBlock.hidden = open;
    if (open) levelButtons.get(aiLevel)?.focus();
    else aiButton.focus();
    update();
  };
  aiButton.addEventListener("click", () => showAiStep(true));
  aiBack.addEventListener("click", () => showAiStep(false));
  aiPanel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") showAiStep(false);
  });
  aiStart.addEventListener("click", () => {
    const nickname = readNickname();
    if (nickname && aiDeck && canStartAiDuel({ nickname, level: aiLevel, deckId: aiDeck })) createAiRoom(nickname, aiLevel, aiDeck);
  });

  createButton.addEventListener("click", submitCreate);
  joinButton.addEventListener("click", submitJoin);
  nicknameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") (presetCode ? submitJoin : submitCreate)();
  });
  codeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitJoin();
  });

  element.append(createPanel("Duelista", nicknameInput, nicknameHint));
  // Lista de salas abertas: só na home geral, não no convite /sala/CODIGO.
  const lobbyList = el("ul", "lobby-list");
  const lobbyEmpty = el("p", "hint lobby-empty");
  const lobbyEmptyIcon = el("span", "lobby-empty-icon");
  lobbyEmptyIcon.setAttribute("aria-hidden", "true");
  // Ícone decorativo estático (sem entrada do usuário): losango dourado sobre círculo roxo tracejado.
  lobbyEmptyIcon.innerHTML =
    '<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="10" fill="var(--c-panel-2)" stroke="var(--c-gold)" stroke-width="1.5" stroke-dasharray="3 2.5"/><path d="M12 6.5 17 12 12 17.5 7 12Z" fill="none" stroke="var(--c-gold-light)" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  lobbyEmpty.append(el("span", undefined, "Nenhuma sala aberta no momento..."), lobbyEmptyIcon);
  if (presetCode) {
    element.append(createPanel(null, joinButton));
  } else {
    const joinRow = el("div", "join-row");
    joinRow.append(codeInput, joinButton);
    const newDuel = createPanel("Novo duelo", createButton, aiButton, el("p", "hint divider", "ou entre com um código"), joinRow);
    newDuel.classList.add("lobby-new");
    const openRooms = createPanel("Salas abertas", lobbyEmpty, lobbyList);
    openRooms.classList.add("lobby-open");
    const block = el("div", "lobby-block");
    block.append(newDuel, openRooms);
    lobbyBlock = block;
    element.append(block, aiPanel);
  }

  let renderedRooms: unknown = null;
  const renderLobby = () => {
    const { lobbyRooms, busy } = getState();
    const nicknameOk = canSubmitNickname(nicknameInput.value);
    if (lobbyRooms !== renderedRooms) {
      renderedRooms = lobbyRooms;
      lobbyEmpty.hidden = lobbyRooms.length > 0;
      lobbyList.replaceChildren(
        ...lobbyRooms.map((room) => {
          const item = el("li", "lobby-item");
          const join = el("button", undefined, "Entrar");
          join.setAttribute("aria-label", `Entrar na sala ${room.code} de ${room.hostNickname}`);
          join.addEventListener("click", () => {
            const nickname = readNickname();
            if (nickname) joinRoom(room.code, nickname);
          });
          item.append(el("span", "lobby-code", room.code), el("span", "lobby-host", room.hostNickname), join);
          return item;
        }),
      );
    }
    lobbyList.querySelectorAll("button").forEach((button) => (button.disabled = busy || !nicknameOk));
  };

  const update = () => {
    const { busy } = getState();
    const nicknameOk = canSubmitNickname(nicknameInput.value);
    createButton.disabled = busy || !nicknameOk;
    aiButton.disabled = busy || !nicknameOk;
    for (const [id, button] of levelButtons) {
      button.setAttribute("aria-pressed", String(id === aiLevel));
      button.classList.toggle("selected", id === aiLevel);
      button.disabled = busy;
    }
    aiDeckPicker.update(aiDeck, busy);
    aiStart.disabled = busy || !canStartAiDuel({ nickname: nicknameInput.value, level: aiLevel, deckId: aiDeck });
    joinButton.disabled = busy || !nicknameOk;
    nicknameHint.hidden = nicknameOk;
    if (!presetCode) renderLobby();
  };
  nicknameInput.addEventListener("input", update);
  update();
  if (presetCode) return { element: home, update };
  subscribeLobby();
  // Rodapé de navegação (guia e cartas): só na home geral.
  home.append(createFooter());
  return {
    element: home,
    update,
    destroy: unsubscribeLobby,
  };
};
