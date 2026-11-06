// src/client/screens/matchScreen.ts
import { getCard } from "../../engine/cards.js";
import type { Phase } from "../../engine/types.js";
import type { PlayerView } from "../../engine/playerView.js";
import { leaveRoom, sendAction, sendRematch } from "../network/socket.js";
import { createMatchScene, type MatchScene } from "../scene/scene.js";
import { getState, loadNickname } from "../state.js";
import { el, type Screen } from "./dom.js";
import { errorMessage } from "./errorMessages.js";
import {
  connectionNotice,
  handClick,
  highlightKeys,
  opponentInRoom,
  phaseCommands,
  responseCommands,
  selectionCommands,
  selectionHint,
  slotClick,
  type Command,
  type Selection,
} from "./matchActions.js";
import { endSummary, rematchState } from "./matchEnd.js";
import { actingPlayer, opponentNickname, secondsRemaining, timerLevel, turnBannerText } from "./turnTimer.js";

const NOTICE_MS = 2200;

export const PHASE_LABELS: Record<Phase, string> = {
  DRAW: "Compra",
  MAIN_1: "Principal 1",
  BATTLE: "Batalha",
  MAIN_2: "Principal 2",
  END: "Fim",
};

const handCardLabel = (cardId: string): { kind: string; title: string; detail: string } => {
  const card = getCard(cardId);
  if (!card) return { kind: "", title: cardId, detail: "" };
  if (card.type === "MONSTER") return { kind: "monster", title: card.name, detail: `ATK ${card.attack} / DEF ${card.defense}` };
  return { kind: card.type === "SPELL" ? "spell" : "trap", title: card.name, detail: card.type === "SPELL" ? "Magia" : "Armadilha" };
};

/** Mesa 3D com HUD em HTML (vida, fase, turno, mão, jogadas, resposta e fim). Representa o último `match:state`; as jogadas vão ao servidor por `match:action`. */
export const createMatchScreen = (): Screen => {
  const element = el("main", "match");
  const canvasBox = el("div", "match-canvas");
  const hud = el("div", "hud");

  const opponentInfo = el("div", "hud-box");
  const turnInfo = el("div", "hud-box hud-center");
  const turnBanner = el("p", "turn-banner");
  const countdown = el("span", "turn-countdown");
  const turnLine = el("p", "hud-banner");
  const phaseLine = el("p", "hint");
  const noticeLine = el("p", "hint");
  turnBanner.append(el("span", "turn-banner-text"), countdown);
  turnInfo.append(turnBanner, turnLine, phaseLine, noticeLine);
  const top = el("div", "hud-bar");
  top.append(opponentInfo, turnInfo);

  const youInfo = el("div", "hud-box");
  const hintLine = el("p", "hud-hint");
  const errorLine = el("p", "error");
  const commandsBox = el("div", "hud-commands");
  const hand = el("div", "hand");
  const bottom = el("div");
  bottom.append(hintLine, errorLine, commandsBox, hand, youInfo);
  youInfo.style.marginTop = "0.5rem";

  hud.append(top, bottom);

  const endTitle = el("h2");
  const endReason = el("p", "hint");
  const rematchButton = el("button", "primary");
  rematchButton.type = "button";
  const rematchStatus = el("p", "hint");
  const lobbyButton = el("button", undefined, "Voltar ao lobby");
  lobbyButton.type = "button";
  const endBox = el("div", "end-box");
  endBox.append(endTitle, endReason, rematchButton, rematchStatus, lobbyButton);
  const endOverlay = el("div", "end-overlay");
  endOverlay.hidden = true;
  endOverlay.append(endBox);
  const turnToast = el("div", "turn-toast");
  turnToast.hidden = true;
  element.append(canvasBox, hud, turnToast, endOverlay);

  let selection: Selection | null = null;
  let lastMatch: PlayerView | null = null;
  let acceptRematch = true;
  let shownNoticeSeq = getState().turnNotice?.seq ?? 0; // aviso já existente ao abrir a tela (ex.: reconexão) não reaparece
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  rematchButton.addEventListener("click", () => sendRematch(acceptRematch));
  lobbyButton.addEventListener("click", () => leaveRoom());

  const runCommand = (command: Command) => {
    if (command.action) {
      selection = null;
      sendAction(command.action);
    } else {
      selection = command.select ?? null;
    }
    update();
  };

  let scene: MatchScene | null = null;
  let observer: ResizeObserver | null = null;
  try {
    scene = createMatchScene(canvasBox);
    const resize = () => scene?.resize(canvasBox.clientWidth, canvasBox.clientHeight);
    observer = new ResizeObserver(resize);
    observer.observe(canvasBox);
    scene.onPick((slot) => {
      const view = getState().match;
      if (!view) return;
      const outcome = slotClick(view, selection, slot);
      selection = outcome.selection;
      if (outcome.action) sendAction(outcome.action);
      update();
    });
  } catch {
    canvasBox.append(el("p", "match-notice error", "Seu navegador não conseguiu iniciar o 3D (WebGL indisponível)."));
  }

  /** Contagem regressiva do turno; recalculada do último prazo recebido, sem depender do relógio local. */
  const renderCountdown = () => {
    const { match, turnClock } = getState();
    if (!match || match.winner || !turnClock) {
      countdown.textContent = "";
      countdown.className = "turn-countdown";
      return;
    }
    const seconds = secondsRemaining(turnClock, Date.now());
    countdown.textContent = `${seconds} s`;
    countdown.className = `turn-countdown ${timerLevel(seconds)}`;
  };
  const countdownInterval = setInterval(renderCountdown, 250);

  const update = () => {
    const { match, connection, errorCode, ended, room, turnNotice } = getState();
    if (!match) return;
    // Nova visão do servidor: a seleção anterior pode não valer mais.
    if (match !== lastMatch) {
      lastMatch = match;
      selection = null;
      scene?.setView(match);
    }
    scene?.setHighlights(highlightKeys(match, selection));

    const { you, opponent } = match;
    opponentInfo.textContent = `Oponente · LP ${opponent.lifePoints} · Mão ${opponent.handCount} · Deck ${opponent.deckCount} · Cemitério ${opponent.graveyard.length}`;
    youInfo.textContent = `Você · LP ${you.lifePoints} · Deck ${you.deckCount} · Cemitério ${you.graveyard.length}`;

    const acting = actingPlayer(match);
    const actingMine = acting === match.viewer;
    turnBanner.className = `turn-banner ${match.winner ? "over" : actingMine ? "mine" : "theirs"}`;
    turnBanner.hidden = !!match.winner;
    (turnBanner.firstElementChild as HTMLElement).textContent = `${turnBannerText(match.viewer, acting, opponentNickname(room?.players ?? [], loadNickname()))} · ${PHASE_LABELS[match.phase]}`;
    renderCountdown();
    if (turnNotice && turnNotice.seq !== shownNoticeSeq) {
      shownNoticeSeq = turnNotice.seq;
      turnToast.textContent = turnNotice.text;
      turnToast.hidden = false;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (turnToast.hidden = true), NOTICE_MS);
    }

    const mine = match.currentPlayer === match.viewer;
    turnLine.textContent = match.winner
      ? match.winner === match.viewer
        ? "Partida encerrada: você venceu!"
        : "Partida encerrada: você perdeu."
      : `Turno ${match.turn} · ${mine ? "Seu turno" : "Turno do oponente"}`;
    phaseLine.textContent = `Fase: ${PHASE_LABELS[match.phase]}`;
    noticeLine.textContent = connectionNotice(connection);
    hintLine.textContent = selectionHint(match, selection);
    errorLine.textContent = errorCode ? errorMessage(errorCode) : "";

    const commands = [
      ...selectionCommands(match, selection),
      ...phaseCommands(match),
      ...responseCommands(match),
    ];
    commandsBox.replaceChildren(
      ...commands.map((command) => {
        const button = el("button", undefined, command.label);
        button.type = "button";
        button.addEventListener("click", () => runCommand(command));
        return button;
      }),
    );

    hand.replaceChildren(
      ...you.hand.map((cardId) => {
        const { kind, title, detail } = handCardLabel(cardId);
        const selected = selection?.kind === "hand" && selection.cardId === cardId;
        const card = el("button", `hand-card ${kind}${selected ? " selected" : ""}`);
        card.type = "button";
        card.append(el("b", undefined, title), el("span", undefined, detail));
        card.addEventListener("click", () => {
          selection = handClick(match, selection, cardId);
          update();
        });
        return card;
      }),
    );

    if (match.winner) {
      const summary = endSummary(match.viewer, match.winner, ended);
      const rematch = rematchState(ended, opponentInRoom(room?.players ?? []));
      endTitle.textContent = summary.title;
      endReason.textContent = summary.reason;
      rematchButton.textContent = rematch.label;
      rematchButton.disabled = rematch.disabled;
      acceptRematch = rematch.accept;
      rematchStatus.textContent = rematch.status;
      endOverlay.hidden = false;
    } else {
      endOverlay.hidden = true;
    }
  };

  update();
  return {
    element,
    update,
    destroy: () => {
      clearInterval(countdownInterval);
      if (toastTimer) clearTimeout(toastTimer);
      observer?.disconnect();
      scene?.dispose();
    },
  };
};
