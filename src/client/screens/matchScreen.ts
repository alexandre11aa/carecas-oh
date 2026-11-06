// src/client/screens/matchScreen.ts
import { getCard } from "../../engine/cards.js";
import type { Phase } from "../../engine/types.js";
import { createMatchScene, type MatchScene } from "../scene/scene.js";
import { getState } from "../state.js";
import { el, type Screen } from "./dom.js";

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
  const turnLine = el("p", "hud-banner");
  const phaseLine = el("p", "hint");
  const noticeLine = el("p", "hint");
  turnInfo.append(turnLine, phaseLine, noticeLine);
  const top = el("div", "hud-bar");
  top.append(opponentInfo, turnInfo);

  const youInfo = el("div", "hud-box");
  const hand = el("div", "hand");
  const bottom = el("div");
  bottom.append(hand, youInfo);
  youInfo.style.marginTop = "0.5rem";

  hud.append(top, bottom);
  element.append(canvasBox, hud);

  let scene: MatchScene | null = null;
  let observer: ResizeObserver | null = null;
  try {
    scene = createMatchScene(canvasBox);
    const resize = () => scene?.resize(canvasBox.clientWidth, canvasBox.clientHeight);
    observer = new ResizeObserver(resize);
    observer.observe(canvasBox);
  } catch {
    canvasBox.append(el("p", "match-notice error", "Seu navegador não conseguiu iniciar o 3D (WebGL indisponível)."));
  }

  const update = () => {
    const { match, connection } = getState();
    if (!match) return;
    scene?.setView(match);

    const { you, opponent } = match;
    opponentInfo.textContent = `Oponente · LP ${opponent.lifePoints} · Mão ${opponent.handCount} · Deck ${opponent.deckCount} · Cemitério ${opponent.graveyard.length}`;
    youInfo.textContent = `Você · LP ${you.lifePoints} · Deck ${you.deckCount} · Cemitério ${you.graveyard.length}`;

    const mine = match.currentPlayer === match.viewer;
    turnLine.textContent = match.winner
      ? match.winner === match.viewer
        ? "Partida encerrada: você venceu!"
        : "Partida encerrada: você perdeu."
      : `Turno ${match.turn} · ${mine ? "Seu turno" : "Turno do oponente"}`;
    phaseLine.textContent = `Fase: ${PHASE_LABELS[match.phase]}`;
    noticeLine.textContent =
      connection !== "online"
        ? "Reconectando ao servidor..."
        : match.pendingResponse && !match.pendingResponse.canRespond
          ? "Aguardando a resposta do oponente..."
          : match.pendingResponse
            ? "Você pode responder com uma armadilha."
            : "";

    hand.replaceChildren(
      ...you.hand.map((cardId) => {
        const { kind, title, detail } = handCardLabel(cardId);
        const card = el("div", `hand-card ${kind}`);
        card.append(el("b", undefined, title), el("span", undefined, detail));
        return card;
      }),
    );
  };

  update();
  return {
    element,
    update,
    destroy: () => {
      observer?.disconnect();
      scene?.dispose();
    },
  };
};
