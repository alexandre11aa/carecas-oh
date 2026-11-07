// src/client/screens/matchScreen.ts
import { floatDelta, flashCounter, playNotice, snapLife, tweenLife } from "../animations/hudEffects.js";
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
import { buildNotices, deltaText, lifePercent, lifeSides, MAX_LIFE, type Notice, type NoticeSide } from "./matchNotices.js";
import { buildCardDetail, slotCardId } from "./cardDetail.js";
import { applyCardArt } from "./cardArtImage.js";
import { reusableHandSlots } from "./handReconcile.js";
import { createCardView } from "./cardView.js";
import { canSurrender, endSummary, rematchState } from "./matchEnd.js";
import { actingPlayer, opponentNickname, secondsRemaining, timerLevel, turnBannerText } from "./turnTimer.js";

const NOTICE_MS = 2200;
const NOTICE_HOLD = 0.9; // segundos de cada aviso de evento
const END_HOLD = 1.6;

type InfoBox = { box: HTMLElement; life: HTMLElement; fill: HTMLElement; rest: HTMLElement; graveyard: HTMLElement };

/** Caixa de status de um jogador: vida com barra, contadores e cemitério (realçável). */
const createInfoBox = (): InfoBox => {
  const box = el("div", "hud-box info-box");
  const life = el("b", "life-text");
  const bar = el("span", "life-bar");
  const fill = el("span", "life-fill");
  bar.append(fill);
  const rest = el("span");
  const graveyard = el("span", "graveyard-count");
  box.append(life, bar, rest, graveyard);
  return { box, life, fill, rest, graveyard };
};

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

  const infoBoxes: Record<NoticeSide, InfoBox> = { opponent: createInfoBox(), you: createInfoBox() };
  const opponentInfo = infoBoxes.opponent.box;
  const turnInfo = el("div", "hud-box hud-center");
  const turnBanner = el("p", "turn-banner");
  const countdown = el("span", "turn-countdown");
  const turnLine = el("p", "hud-banner");
  const phaseLine = el("p", "hint");
  const noticeLine = el("p", "hint");
  turnBanner.append(el("span", "turn-banner-text"), countdown);
  turnInfo.append(turnBanner, turnLine, phaseLine, noticeLine);
  const top = el("div", "hud-bar");
  const surrenderButton = el("button", "surrender-button", "Desistir");
  surrenderButton.type = "button";
  top.append(opponentInfo, turnInfo, surrenderButton);

  const youInfo = infoBoxes.you.box;
  const hintLine = el("p", "hud-hint");
  const errorLine = el("p", "error");
  const commandsBox = el("div", "hud-commands");
  const hand = el("div", "hand");
  let handButtons: HTMLButtonElement[] = [];
  let handCardIds: string[] = [];
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
  const surrenderTitle = el("h2", undefined, "Desistir da partida?");
  const surrenderText = el("p", "hint", "O oponente vencerá.");
  const surrenderConfirm = el("button", "primary", "Desistir");
  surrenderConfirm.type = "button";
  const surrenderCancel = el("button", undefined, "Cancelar");
  surrenderCancel.type = "button";
  const surrenderBox = el("div", "end-box");
  surrenderBox.append(surrenderTitle, surrenderText, surrenderConfirm, surrenderCancel);
  const surrenderOverlay = el("div", "end-overlay surrender-overlay");
  surrenderOverlay.hidden = true;
  surrenderOverlay.append(surrenderBox);
  const turnToast = el("div", "turn-toast");
  turnToast.hidden = true;
  const eventNotice = el("div", "event-notice");
  eventNotice.hidden = true;
  const detailPanel = el("aside", "card-detail");
  detailPanel.hidden = true;
  // Contêiner flex central: empilha toast (acima) e evento (abaixo) sem depender de transform (o GSAP anima scale/y do aviso).
  const toasts = el("div", "match-toasts");
  toasts.append(turnToast, eventNotice);
  element.append(canvasBox, hud, detailPanel, toasts, endOverlay, surrenderOverlay);

  // Detalhe da carta sob o ponteiro (mão ou mesa). Guarda só o id; cartas ocultas (null) não mostram nada.
  let detailCardId: string | null = null;
  const showDetail = (cardId: string | null) => {
    if (cardId !== null && cardId === detailCardId && !detailPanel.hidden) return; // já mostrando: não recria (evita pisca da arte)
    detailCardId = cardId;
    const detail = buildCardDetail(cardId);
    detailPanel.hidden = !detail;
    detailPanel.replaceChildren(...(detail ? [createCardView(detail)] : []));
  };

  let selection: Selection | null = null;
  let lastMatch: PlayerView | null = null;
  let acceptRematch = true;
  let shownNoticeSeq = getState().turnNotice?.seq ?? 0; // aviso já existente ao abrir a tela (ex.: reconexão) não reaparece
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Fila de avisos dos eventos. A vida dos lados com dano/cura fica "retida" até o aviso aparecer; ao esvaziar a fila tudo volta ao estado do servidor.
  let shownEventSeq = getState().matchEvents?.seq ?? 0; // eventos já existentes ao abrir a tela não reaparecem
  const noticeQueue: Notice[] = [];
  const heldLife = new Set<NoticeSide>();
  const lifeShown: Record<NoticeSide, { value: number }> = { you: { value: MAX_LIFE }, opponent: { value: MAX_LIFE } };
  let playing = false;
  let noticeTimeline: { kill: () => void } | null = null;

  const renderLife = (side: NoticeSide, value: number) => {
    infoBoxes[side].life.textContent = `LP ${value}`;
    infoBoxes[side].fill.style.width = `${lifePercent(value)}%`;
  };
  const serverLife = (side: NoticeSide): number => (side === "you" ? lastMatch?.you.lifePoints : lastMatch?.opponent.lifePoints) ?? MAX_LIFE;
  const snapAllLife = () => (["you", "opponent"] as const).forEach((side) => snapLife(lifeShown[side], serverLife(side), (value) => renderLife(side, value)));

  const stopNotices = () => {
    noticeQueue.length = 0;
    heldLife.clear();
    playing = false;
    noticeTimeline?.kill();
    noticeTimeline = null;
    eventNotice.hidden = true;
  };

  const pumpNotices = () => {
    if (playing) return;
    const notice = noticeQueue.shift();
    if (!notice) {
      heldLife.clear();
      snapAllLife();
      eventNotice.hidden = true;
      update(); // libera a tela de fim, se houver
      return;
    }
    playing = true;
    eventNotice.textContent = notice.kind === "DAMAGE" || notice.kind === "HEAL" ? `${notice.text} (${deltaText(notice)})` : notice.text;
    eventNotice.className = `event-notice ${notice.kind.toLowerCase()} ${notice.side}${notice.victory === false ? " defeat" : ""}`;
    eventNotice.hidden = false;
    if (notice.kind === "GRAVEYARD") flashCounter(infoBoxes[notice.side].graveyard);
    if (notice.kind === "DAMAGE" || notice.kind === "HEAL") {
      floatDelta(infoBoxes[notice.side].box, deltaText(notice), notice.kind === "DAMAGE" ? "damage" : "heal");
      tweenLife(lifeShown[notice.side], serverLife(notice.side), (value) => renderLife(notice.side, value));
    }
    const isEnd = notice.kind === "END";
    noticeTimeline = playNotice(eventNotice, isEnd ? END_HOLD : NOTICE_HOLD, !isEnd, () => {
      playing = false;
      pumpNotices();
    });
  };

  /** Recebe o lote de eventos novo: avisos entram na fila; sem eventos (reconexão) a fila é descartada e o estado é exibido direto. */
  const receiveEvents = (match: PlayerView, batch: NonNullable<ReturnType<typeof getState>["matchEvents"]>) => {
    const notices = buildNotices(batch.events, match.viewer);
    if (notices.length === 0) {
      if (batch.events.length === 0) stopNotices();
      return;
    }
    lifeSides(notices).forEach((side) => heldLife.add(side));
    noticeQueue.push(...notices);
    pumpNotices();
  };

  rematchButton.addEventListener("click", () => sendRematch(acceptRematch));
  lobbyButton.addEventListener("click", () => leaveRoom());
  // Desistir exige confirmação: o clique no botão só abre o diálogo; apenas "Desistir" nele envia `room:leave`.
  surrenderButton.addEventListener("click", () => (surrenderOverlay.hidden = false));
  surrenderCancel.addEventListener("click", () => (surrenderOverlay.hidden = true));
  surrenderConfirm.addEventListener("click", () => {
    surrenderOverlay.hidden = true;
    leaveRoom();
  });

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
    scene.onHover((slot) => {
      const view = getState().match;
      const cardId = view && slot ? slotCardId(view, slot) : null;
      if (cardId !== detailCardId) showDetail(cardId);
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
    const { match, connection, errorCode, ended, room, turnNotice, matchEvents } = getState();
    if (!match) return;
    // Nova visão do servidor: a seleção anterior pode não valer mais.
    if (match !== lastMatch) {
      lastMatch = match;
      selection = null;
      scene?.setView(match);
    }
    scene?.setHighlights(highlightKeys(match, selection));
    if (matchEvents && matchEvents.seq !== shownEventSeq) {
      shownEventSeq = matchEvents.seq;
      receiveEvents(match, matchEvents);
    }

    const { you, opponent } = match;
    infoBoxes.opponent.rest.textContent = ` Oponente · Mão ${opponent.handCount} · Deck ${opponent.deckCount} · `;
    infoBoxes.opponent.graveyard.textContent = `Cemitério ${opponent.graveyard.length}`;
    infoBoxes.you.rest.textContent = ` Você · Deck ${you.deckCount} · `;
    infoBoxes.you.graveyard.textContent = `Cemitério ${you.graveyard.length}`;
    (["you", "opponent"] as const).forEach((side) => {
      if (!heldLife.has(side)) snapLife(lifeShown[side], serverLife(side), (value) => renderLife(side, value));
    });

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

    // Reconcilia a mão: botões já existentes para a mesma carta na mesma posição são mantidos (a arte PNG
    // não é recriada nem recarregada, e o foco do teclado não se perde); só a seleção é atualizada.
    const reuse = reusableHandSlots(handCardIds, you.hand);
    const buttons = you.hand.map((cardId, index) => {
      const selected = selection?.kind === "hand" && selection.cardId === cardId;
      const existing = reuse[index] ? handButtons[index] : undefined;
      if (existing) {
        existing.classList.toggle("selected", selected);
        return existing;
      }
      const { kind, title, detail } = handCardLabel(cardId);
      const card = el("button", `hand-card ${kind}${selected ? " selected" : ""}`);
      card.type = "button";
      card.append(el("b", undefined, title), el("span", undefined, detail));
      card.setAttribute("aria-label", `${title}. ${detail}`);
      applyCardArt(card, cardId, title);
      card.addEventListener("mouseenter", () => showDetail(cardId));
      card.addEventListener("focus", () => showDetail(cardId));
      card.addEventListener("mouseleave", () => showDetail(null));
      card.addEventListener("blur", () => showDetail(null));
      card.addEventListener("click", () => {
        if (!lastMatch) return;
        showDetail(cardId);
        selection = handClick(lastMatch, selection, cardId); // sempre o estado mais recente, nunca o de quando o botão foi criado
        update();
      });
      return card;
    });
    if (buttons.some((button, index) => button !== handButtons[index]) || buttons.length !== handButtons.length) {
      hand.replaceChildren(...buttons);
    }
    handButtons = buttons;
    handCardIds = [...you.hand];

    const surrenderAllowed = canSurrender(match.winner, ended);
    surrenderButton.hidden = !surrenderAllowed;
    if (!surrenderAllowed) surrenderOverlay.hidden = true;

    if (match.winner && !playing && noticeQueue.length === 0) {
      const summary = endSummary(match.viewer, match.winner, ended);
      const rematch = rematchState(ended, opponentInRoom(room?.players ?? []));
      endTitle.textContent = summary.title;
      endReason.textContent = summary.reason;
      rematchButton.textContent = rematch.label;
      rematchButton.disabled = rematch.disabled;
      acceptRematch = rematch.accept;
      rematchStatus.textContent = rematch.status;
      endTitle.className = match.winner === match.viewer ? "victory" : "defeat";
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
      stopNotices();
      observer?.disconnect();
      scene?.dispose();
    },
  };
};
