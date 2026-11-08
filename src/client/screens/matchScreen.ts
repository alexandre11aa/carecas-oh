// src/client/screens/matchScreen.ts
import { floatDelta, flashCounter, playNotice, snapLife, stopHudEffects, tweenLife } from "../animations/hudEffects.js";
import { getCard } from "../../engine/cards.js";
import type { DeckId } from "../../engine/decks.js";
import type { Phase } from "../../engine/types.js";
import type { PlayerView } from "../../engine/playerView.js";
import { leaveRoom, sendAction, sendRematch } from "../network/socket.js";
import { createMatchScene, type MatchScene } from "../scene/scene.js";
import { getState, loadNickname } from "../state.js";
import { el, type Screen } from "./dom.js";
import { criticalTextureUrls } from "../scene/texturePaths.js";
import { pageLoading, trackImage, trackTextures } from "./pageLoading.js";
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
import { buildNotices, deltaText, lifePercent, lifeSides, MAX_LIFE, type NoticeSide } from "./matchNotices.js";
import { buildCardDetail, slotCardId } from "./cardDetail.js";
import { applyCardArt } from "./cardArtImage.js";
import { reusableHandSlots } from "./handReconcile.js";
import { createCardView } from "./cardView.js";
import { createDeckPicker } from "./deckPicker.js";
import { asDeckId, deckOptionFor, selectDeck } from "./deckSelect.js";
import { aiOpponentLabel } from "./aiDuel.js";
import { canSurrender, endSummary, rematchState } from "./matchEnd.js";
import { actingPlayer, opponentNickname, secondsRemaining, timerLevel, turnBannerText } from "./turnTimer.js";
import { buildFeedback, type FeedbackStep } from "../animations/matchFeedback.js";
import { createMatchAudio } from "../animations/matchAudio.js";
import { playDamageFlash } from "../animations/hudEffects.js";

const NOTICE_MS = 2200;
const NOTICE_HOLD = 0.9; // segundos de cada aviso de evento
const END_HOLD = 1.6;

type InfoBox = { box: HTMLElement; life: HTMLElement; fill: HTMLElement; rest: HTMLElement; graveyard: HTMLElement; deck: HTMLElement };

/** Caixa de status de um jogador: vida com barra, contadores e cemitério (realçável). */
const createInfoBox = (): InfoBox => {
  const box = el("div", "hud-box info-box");
  const life = el("b", "life-text");
  const bar = el("span", "life-bar");
  const fill = el("span", "life-fill");
  bar.append(fill);
  const rest = el("span");
  const graveyard = el("span", "graveyard-count");
  const deck = el("span", "deck-badge");
  box.append(life, bar, rest, graveyard, deck);
  return { box, life, fill, rest, graveyard, deck };
};

/** Miniatura e nome do deck em uso; sem a imagem, o nome em texto basta. */
const renderDeckBadge = (badge: HTMLElement, deckId: unknown) => {
  const option = deckOptionFor(deckId);
  if (badge.dataset.deck === (option?.id ?? "")) return; // já mostrando: não recria (evita pisca)
  badge.dataset.deck = option?.id ?? "";
  badge.replaceChildren();
  if (!option) return;
  badge.title = option.label;
  const image = el("img", "deck-badge-image");
  image.alt = "";
  image.src = option.image;
  trackImage(image);
  image.addEventListener("error", () => image.remove());
  badge.append(image, el("span", "deck-badge-name", option.name));
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
  const audio = createMatchAudio();
  const soundButton = el("button", "sound-button");
  soundButton.type = "button";
  const renderSound = () => {
    soundButton.textContent = audio.isEnabled() ? "Som: ligado" : "Som: desligado";
    soundButton.setAttribute("aria-pressed", String(audio.isEnabled()));
    soundButton.setAttribute("aria-label", audio.isEnabled() ? "Desativar sons da partida" : "Ativar sons da partida");
  };
  soundButton.addEventListener("click", () => { audio.setEnabled(!audio.isEnabled()); renderSound(); });
  renderSound();
  const topActions = el("div", "hud-top-actions");
  topActions.append(soundButton, surrenderButton);
  top.append(opponentInfo, turnInfo, topActions);

  const youInfo = infoBoxes.you.box;
  const hintLine = el("p", "hud-hint");
  const commandsBox = el("div", "hud-commands");
  const detailPanel = el("aside", "card-detail");
  detailPanel.hidden = true;
  const hand = el("div", "hand");
  let handButtons: HTMLButtonElement[] = [];
  let handCardIds: string[] = [];
  const bottom = el("div");
  // O painel de detalhe da carta fica na linha da mão: acima da barra de vida pela própria estrutura do DOM.
  const handRow = el("div", "hand-row");
  handRow.append(detailPanel, hand);
  bottom.append(hintLine, commandsBox, handRow, youInfo);
  youInfo.style.marginTop = "0.5rem";

  hud.append(top, bottom);

  const endTitle = el("h2");
  const endReason = el("p", "hint");
  const rematchButton = el("button", "primary");
  rematchButton.type = "button";
  const rematchStatus = el("p", "end-notice");
  rematchStatus.hidden = true;
  const lobbyButton = el("button", undefined, "Voltar ao lobby");
  lobbyButton.type = "button";
  const deckPicker = createDeckPicker("Escolha seu deck para a revanche", (id) => {
    selectedDeck = selectDeck(selectedDeck, id, decksLocked);
    update();
  });
  const endBox = el("div", "end-box");
  endBox.append(endTitle, endReason, deckPicker.element, rematchButton, rematchStatus, lobbyButton);
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
  // Contêiner flex central: empilha toast (acima) e evento (abaixo) sem depender de transform (o GSAP anima scale/y do aviso).
  const toasts = el("div", "match-toasts");
  toasts.append(turnToast, eventNotice);
  const damageFlash = el("div", "damage-flash");
  damageFlash.setAttribute("aria-hidden", "true");
  element.append(canvasBox, damageFlash, hud, toasts, endOverlay, surrenderOverlay);

  // Detalhe da carta sob o ponteiro (mão ou mesa). Guarda só o id; cartas ocultas (null) não mostram nada.
  let detailCardId: string | null = null;
  const showDetail = (cardId: string | null) => {
    if (cardId !== null && cardId === detailCardId && !detailPanel.hidden) return; // já mostrando: não recria (evita pisca da arte)
    detailCardId = cardId;
    detailPanel.dataset.cardId = cardId ?? "";
    const detail = buildCardDetail(cardId);
    detailPanel.hidden = !detail;
    detailPanel.replaceChildren(...(detail ? [createCardView(detail)] : []));
  };
  // Um único ponto reconcilia hover/foco da mão após mudanças no DOM. O painel
  // fica fora do fluxo: mostrá-lo não desloca a carta que está sob o ponteiro.
  let pointerPosition: { x: number; y: number } | null = null;
  const refreshHandDetail = () => {
    const pointed = pointerPosition ? document.elementFromPoint(pointerPosition.x, pointerPosition.y)?.closest<HTMLButtonElement>(".hand-card") : null;
    const focused = !pointerPosition && document.activeElement instanceof HTMLButtonElement && hand.contains(document.activeElement) ? document.activeElement : null;
    const button = pointed ?? focused;
    if (button && hand.contains(button)) showDetail(button.dataset.cardId ?? null);
  };
  element.addEventListener("pointermove", (event) => {
    pointerPosition = { x: event.clientX, y: event.clientY };
    refreshHandDetail();
  });
  element.addEventListener("pointerleave", () => { pointerPosition = null; showDetail(null); });

  let selection: Selection | null = null;
  let lastMatch: PlayerView | null = null;
  let acceptRematch = true;
  let decksLocked = false;
  let selectedDeck: DeckId | null = asDeckId(getState().deckId); // escolha anterior pré-selecionada, editável
  let shownNoticeSeq = getState().turnNotice?.seq ?? 0; // aviso já existente ao abrir a tela (ex.: reconexão) não reaparece
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Fila de avisos dos eventos. A vida dos lados com dano/cura fica "retida" até o aviso aparecer; ao esvaziar a fila tudo volta ao estado do servidor.
  let shownEventSeq = getState().matchEvents?.seq ?? 0; // eventos já existentes ao abrir a tela não reaparecem
  const noticeQueue: FeedbackStep[] = [];
  const heldLife = new Set<NoticeSide>();
  const lifeShown: Record<NoticeSide, { value: number }> = { you: { value: MAX_LIFE }, opponent: { value: MAX_LIFE } };
  const lifeTargets: Record<NoticeSide, number> = { you: MAX_LIFE, opponent: MAX_LIFE };
  let playing = false;
  let noticeTimeline: { kill: () => void } | null = null;
  let effectTimer: ReturnType<typeof setTimeout> | null = null;
  let damageTimeline: { kill: () => void } | null = null;

  const renderLife = (side: NoticeSide, value: number) => {
    infoBoxes[side].life.textContent = `LP ${value}`;
    infoBoxes[side].fill.style.width = `${lifePercent(value)}%`;
  };
  const serverLife = (side: NoticeSide): number => (side === "you" ? lastMatch?.you.lifePoints : lastMatch?.opponent.lifePoints) ?? MAX_LIFE;
  const snapAllLife = () => (["you", "opponent"] as const).forEach((side) => {
    lifeTargets[side] = serverLife(side);
    snapLife(lifeShown[side], lifeTargets[side], (value) => renderLife(side, value));
  });

  const stopNotices = () => {
    noticeQueue.length = 0;
    heldLife.clear();
    playing = false;
    noticeTimeline?.kill();
    noticeTimeline = null;
    if (effectTimer) clearTimeout(effectTimer);
    effectTimer = null;
    damageTimeline?.kill();
    damageFlash.style.opacity = "0";
    audio.stop();
    scene?.clearEffects();
    stopHudEffects(element);
    snapAllLife();
    eventNotice.hidden = true;
  };

  const pumpNotices = () => {
    if (playing) return;
    const step = noticeQueue.shift();
    if (!step) {
      heldLife.clear();
      snapAllLife();
      eventNotice.hidden = true;
      update(); // libera a tela de fim, se houver
      return;
    }
    playing = true;
    audio.play(step.sound);
    scene?.playEffects(step.effects);
    if (step.effects.some((effect) => effect.kind === "damage" && effect.side === "you")) {
      damageTimeline?.kill();
      damageTimeline = playDamageFlash(damageFlash);
    }
    const notice = step.notice;
    if (!notice) {
      eventNotice.hidden = true;
      effectTimer = setTimeout(() => { effectTimer = null; playing = false; pumpNotices(); }, step.effects.length ? 450 : 180);
      return;
    }
    eventNotice.textContent = notice.kind === "DAMAGE" || notice.kind === "HEAL" ? `${notice.text} (${deltaText(notice)})` : notice.text;
    eventNotice.className = `event-notice ${notice.kind.toLowerCase()} ${notice.side}${notice.victory === false ? " defeat" : ""}`;
    eventNotice.hidden = false;
    if (notice.kind === "GRAVEYARD") flashCounter(infoBoxes[notice.side].graveyard);
    if (notice.kind === "DAMAGE" || notice.kind === "HEAL") {
      floatDelta(infoBoxes[notice.side].box, deltaText(notice), notice.kind === "DAMAGE" ? "damage" : "heal");
      const nextLife = Math.max(0, Math.min(MAX_LIFE, lifeTargets[notice.side] + (notice.kind === "DAMAGE" ? -1 : 1) * (notice.amount ?? 0)));
      lifeTargets[notice.side] = nextLife;
      tweenLife(lifeShown[notice.side], nextLife, (value) => renderLife(notice.side, value));
    }
    const isEnd = notice.kind === "END";
    noticeTimeline = playNotice(eventNotice, isEnd ? END_HOLD : noticeQueue.length > 8 ? 0.05 : Math.min(NOTICE_HOLD, 0.35), !isEnd, () => {
      playing = false;
      pumpNotices();
    });
  };

  /** Recebe o lote de eventos novo: avisos entram na fila; sem eventos (reconexão) a fila é descartada e o estado é exibido direto. */
  const receiveEvents = (match: PlayerView, batch: NonNullable<ReturnType<typeof getState>["matchEvents"]>, previous: PlayerView | null) => {
    if (batch.events.length === 0 || document.hidden) { stopNotices(); return; }
    const steps = buildFeedback(previous, match, batch.events);
    const notices = buildNotices(batch.events, match.viewer);
    // Uma aba lenta não acumula dezenas de segundos de efeitos antigos.
    if (noticeQueue.length + steps.length > 32) { stopNotices(); snapAllLife(); return; }
    lifeSides(notices).forEach((side) => heldLife.add(side));
    noticeQueue.push(...steps);
    pumpNotices();
  };

  rematchButton.addEventListener("click", () => {
    sendRematch(acceptRematch, selectedDeck);
    if (!acceptRematch) selectedDeck = null;
  });
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

  // Texturas críticas do estado inicial seguram o loading em tela cheia (main.ts); a cena as reaproveita do cache.
  trackTextures(criticalTextureUrls(getState().match));
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
    const { match, connection, ended, room, turnNotice, matchEvents } = getState();
    if (!match) return;
    // Nova visão do servidor: a seleção anterior pode não valer mais.
    const previousMatch = lastMatch;
    if (match !== lastMatch) {
      if (lastMatch && (match.viewer !== lastMatch.viewer || match.turn < lastMatch.turn || (lastMatch.winner && !match.winner))) stopNotices();
      lastMatch = match;
      selection = null;
      scene?.setView(match);
    }
    scene?.setHighlights(highlightKeys(match, selection));
    // Enquanto o loading cobre a tela, avisos e toasts esperam (as animações só começam depois dele).
    const ready = pageLoading.isReady();
    if (ready && matchEvents && matchEvents.seq !== shownEventSeq) {
      shownEventSeq = matchEvents.seq;
      receiveEvents(match, matchEvents, previousMatch);
    }

    const { you, opponent } = match;
    const aiLabel = aiOpponentLabel(room);
    infoBoxes.opponent.rest.textContent = ` ${aiLabel ?? "Oponente"} · Mão ${opponent.handCount} · Deck ${opponent.deckCount} · `;
    infoBoxes.opponent.graveyard.textContent = `Cemitério ${opponent.graveyard.length}`;
    infoBoxes.you.rest.textContent = ` Você · Deck ${you.deckCount} · `;
    infoBoxes.you.graveyard.textContent = `Cemitério ${you.graveyard.length}`;
    renderDeckBadge(infoBoxes.opponent.deck, opponent.deckId);
    renderDeckBadge(infoBoxes.you.deck, you.deckId);
    (["you", "opponent"] as const).forEach((side) => {
      if (!heldLife.has(side)) {
        lifeTargets[side] = serverLife(side);
        snapLife(lifeShown[side], lifeTargets[side], (value) => renderLife(side, value));
      }
    });

    const acting = actingPlayer(match);
    const actingMine = acting === match.viewer;
    turnBanner.className = `turn-banner ${match.winner ? "over" : actingMine ? "mine" : "theirs"}`;
    turnBanner.hidden = !!match.winner;
    (turnBanner.firstElementChild as HTMLElement).textContent = `${turnBannerText(match.viewer, acting, aiLabel ?? opponentNickname(room?.players ?? [], loadNickname()))} · ${PHASE_LABELS[match.phase]}`;
    renderCountdown();
    if (ready && turnNotice && turnNotice.seq !== shownNoticeSeq) {
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
      card.dataset.cardId = cardId;
      card.type = "button";
      card.append(el("b", undefined, title), el("span", undefined, detail));
      card.setAttribute("aria-label", `${title}. ${detail}`);
      applyCardArt(card, cardId, title);
      card.addEventListener("pointerenter", () => showDetail(cardId));
      card.addEventListener("focus", () => { pointerPosition = null; showDetail(cardId); });
      card.addEventListener("pointerleave", () => showDetail(null));
      card.addEventListener("blur", () => showDetail(null));
      card.addEventListener("click", () => {
        if (!lastMatch) return;
        showDetail(cardId);
        selection = handClick(lastMatch, selection, cardId); // sempre o estado mais recente, nunca o de quando o botão foi criado
        update();
      });
      return card;
    });
    const focusedHand = hand.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    if (buttons.some((button, index) => button !== handButtons[index]) || buttons.length !== handButtons.length) {
      hand.replaceChildren(...buttons);
      if (focusedHand && hand.contains(focusedHand)) focusedHand.focus({ preventScroll: true });
      showDetail(null);
    }
    handButtons = buttons;
    handCardIds = [...you.hand];
    refreshHandDetail();
    scene?.refreshHover();

    const surrenderAllowed = canSurrender(match.winner, ended);
    surrenderButton.hidden = !surrenderAllowed;
    if (!surrenderAllowed) surrenderOverlay.hidden = true;

    if (match.winner && !playing && noticeQueue.length === 0) {
      const summary = endSummary(match.viewer, match.winner, ended);
      selectedDeck ??= asDeckId(getState().deckId);
      const rematch = rematchState(ended, opponentInRoom(room?.players ?? []), selectedDeck, room?.vsAi === true);
      decksLocked = rematch.decksLocked;
      deckPicker.update(selectedDeck, decksLocked);
      endTitle.textContent = summary.title;
      endReason.textContent = summary.reason;
      rematchButton.textContent = rematch.label;
      rematchButton.disabled = rematch.disabled;
      acceptRematch = rematch.accept;
      rematchStatus.textContent = rematch.status;
      rematchStatus.hidden = rematch.statusKind === "none";
      rematchStatus.className = `end-notice ${rematch.statusKind}`;
      endTitle.className = match.winner === match.viewer ? "victory" : "defeat";
      endOverlay.hidden = false;
    } else {
      endOverlay.hidden = true;
    }
  };

  update();
  const stopWaitingLoading = pageLoading.subscribe(() => {
    if (pageLoading.isReady()) update();
  });
  const onVisibilityChange = () => { if (document.hidden) { stopNotices(); snapAllLife(); } };
  document.addEventListener("visibilitychange", onVisibilityChange);
  return {
    element,
    update,
    destroy: () => {
      stopWaitingLoading();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(countdownInterval);
      if (toastTimer) clearTimeout(toastTimer);
      stopNotices();
      audio.dispose();
      observer?.disconnect();
      scene?.dispose();
    },
  };
};
