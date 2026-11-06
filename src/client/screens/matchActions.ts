// src/client/screens/matchActions.ts
// Lógica pura (sem DOM nem WebGL): visão da partida + seleção => comandos e ação a enviar.
// Quem decide se a jogada é válida é o servidor; aqui só se escolhe qual `match:action` montar.
import { getCard } from "../../engine/cards.js";
import type { PlayerView } from "../../engine/playerView.js";
import type { Action, Phase, TrapTrigger } from "../../engine/types.js";
import { slotKey, ZONE_COUNT, type Slot } from "../scene/layout.js";

/** O que o jogador tem selecionado (estado visual, fora do `state.ts`). */
export type Selection =
  | { kind: "hand"; cardId: string }
  | { kind: "field"; cardId: string }
  | { kind: "monster"; zone: number }
  | { kind: "summon"; cardId: string; set: boolean; tributes: readonly string[] }
  | { kind: "attack"; attackerCardId: string }
  | { kind: "spellTarget"; cardId: string; side: "you" | "opponent" };

/** Botão da interface: ou envia uma ação, ou muda a seleção (`null` limpa). */
export type Command = { label: string; action?: Action; select?: Selection | null };

export type ClickOutcome = { selection: Selection | null; action?: Action };

const NEXT_PHASE_LABEL: Record<Phase, string> = {
  DRAW: "Principal 1",
  MAIN_1: "Batalha",
  BATTLE: "Principal 2",
  MAIN_2: "Fim",
  END: "próxima",
};

export const TRIGGER_LABELS: Record<TrapTrigger, string> = {
  ATTACK_DECLARED: "O oponente declarou um ataque.",
  SUMMON: "O oponente está invocando um monstro.",
  SPELL_ACTIVATION: "O oponente está ativando uma magia.",
};

/** Tributos exigidos: níveis 1-4 nenhum, 5-6 um, 7 ou mais dois (regra pública do jogo, só para guiar a seleção). */
export const tributesNeeded = (level: number): number => (level >= 7 ? 2 : level >= 5 ? 1 : 0);

const isMain = (view: PlayerView): boolean => view.phase === "MAIN_1" || view.phase === "MAIN_2";

/** Pode agir normalmente: partida em andamento, seu turno e sem janela de resposta aberta. */
export const canAct = (view: PlayerView): boolean =>
  view.winner === null && view.currentPlayer === view.viewer && view.pendingResponse === null;

const opponentHasMonsters = (view: PlayerView): boolean => view.opponent.monsters.some((m) => m !== null);

const cancel: Command = { label: "Cancelar", select: null };

/** Comando de ativação de magia: pede alvo quando o efeito precisa de um. */
const activateSpell = (cardId: string): Command => {
  const card = getCard(cardId);
  const effect = card?.type === "SPELL" ? card.effect.kind : null;
  if (effect === "BOOST_ATTACK") return { label: "Ativar magia", select: { kind: "spellTarget", cardId, side: "you" } };
  if (effect === "DESTROY_MONSTER") return { label: "Ativar magia", select: { kind: "spellTarget", cardId, side: "opponent" } };
  return { label: "Ativar magia", action: { type: "ACTIVATE_SPELL", cardId } };
};

const monsterCommands = (view: PlayerView, zone: number): Command[] => {
  const monster = view.you.monsters[zone];
  if (!monster) return [];
  const commands: Command[] = [];
  if (isMain(view)) {
    const locked =
      monster.summonedOnTurn === view.turn || monster.hasAttacked || monster.changedPositionOnTurn === view.turn;
    if (!locked) {
      if (monster.faceDown) commands.push({ label: "Virar para ataque", action: { type: "FLIP_SUMMON", cardId: monster.cardId } });
      else {
        const label = monster.position === "ATTACK" ? "Mudar para defesa" : "Mudar para ataque";
        commands.push({ label, action: { type: "CHANGE_POSITION", cardId: monster.cardId } });
      }
    }
  }
  if (view.phase === "BATTLE" && monster.position === "ATTACK" && !monster.faceDown && !monster.hasAttacked) {
    commands.push({ label: "Atacar", select: { kind: "attack", attackerCardId: monster.cardId } });
  }
  return commands;
};

/** Botões da carta/monstro selecionado. Vazio quando não há seleção ou não é a vez de agir. */
export const selectionCommands = (view: PlayerView, selection: Selection | null): Command[] => {
  if (!selection || !canAct(view)) return [];
  switch (selection.kind) {
    case "hand": {
      if (!isMain(view)) return [cancel];
      const card = getCard(selection.cardId);
      if (card?.type === "MONSTER") {
        return [
          { label: "Invocar", select: { kind: "summon", cardId: card.id, set: false, tributes: [] } },
          { label: "Baixar em defesa", select: { kind: "summon", cardId: card.id, set: true, tributes: [] } },
          cancel,
        ];
      }
      if (card?.type === "SPELL") {
        return [activateSpell(card.id), { label: "Baixar virada", action: { type: "SET_SPELL_TRAP", cardId: card.id } }, cancel];
      }
      if (card?.type === "TRAP") return [{ label: "Baixar armadilha", action: { type: "SET_SPELL_TRAP", cardId: card.id } }, cancel];
      return [cancel];
    }
    case "field":
      return getCard(selection.cardId)?.type === "SPELL" && isMain(view)
        ? [activateSpell(selection.cardId), cancel]
        : [cancel];
    case "monster":
      return [...monsterCommands(view, selection.zone), cancel];
    case "attack":
      return opponentHasMonsters(view)
        ? [cancel]
        : [{ label: "Ataque direto", action: { type: "ATTACK", attackerCardId: selection.attackerCardId, targetZone: null } }, cancel];
    case "summon":
    case "spellTarget":
      return [cancel];
  }
};

/** Botões de fase/turno do jogador do turno. */
export const phaseCommands = (view: PlayerView): Command[] =>
  canAct(view)
    ? [
        { label: `Avançar fase (${NEXT_PHASE_LABEL[view.phase]})`, action: { type: "NEXT_PHASE" } },
        { label: "Encerrar turno", action: { type: "END_TURN" } },
      ]
    : [];

/** Janela de resposta: armadilhas elegíveis do defensor (viradas, baixadas em turno anterior, mesmo gatilho) e passar. */
export const responseCommands = (view: PlayerView): Command[] => {
  const pending = view.pendingResponse;
  if (!pending?.canRespond || view.winner !== null) return [];
  const commands: Command[] = [];
  for (const slot of view.you.spellTraps) {
    if (!slot) continue;
    const card = getCard(slot.cardId);
    if (card?.type !== "TRAP" || card.trigger !== pending.trigger || slot.setOnTurn >= view.turn) continue;
    commands.push({ label: `Ativar ${card.name}`, action: { type: "ACTIVATE_TRAP", cardId: card.id } });
  }
  commands.push({ label: "Passar", action: { type: "PASS_RESPONSE" } });
  return commands;
};

/** Clique em uma carta da mão: seleciona (ou limpa, se já estava selecionada). */
export const handClick = (view: PlayerView, selection: Selection | null, cardId: string): Selection | null => {
  if (!canAct(view)) return null;
  return selection?.kind === "hand" && selection.cardId === cardId ? null : { kind: "hand", cardId };
};

/** Zonas do seu campo onde o monstro em invocação pode entrar (livres ou liberadas pelos tributos). */
export const summonZones = (view: PlayerView, tributes: readonly string[]): number[] =>
  Array.from({ length: ZONE_COUNT }, (_, zone) => zone).filter((zone) => {
    const monster = view.you.monsters[zone];
    return monster === null || monster === undefined || tributes.includes(monster.cardId);
  });

const summonNeeded = (cardId: string): number => {
  const card = getCard(cardId);
  return card?.type === "MONSTER" ? tributesNeeded(card.level) : 0;
};

/** Clique em um slot da mesa: devolve a nova seleção e, se a jogada ficou completa, a ação a enviar. */
export const slotClick = (view: PlayerView, selection: Selection | null, slot: Slot): ClickOutcome => {
  if (!canAct(view)) return { selection: null };
  const ownMonster = slot.side === "you" && slot.kind === "monster" ? view.you.monsters[slot.zone] ?? null : null;

  if (selection?.kind === "summon") {
    if (slot.side !== "you" || slot.kind !== "monster") return { selection };
    const needed = summonNeeded(selection.cardId);
    if (selection.tributes.length < needed) {
      if (!ownMonster) return { selection };
      const picked = selection.tributes.includes(ownMonster.cardId)
        ? selection.tributes.filter((id) => id !== ownMonster.cardId)
        : [...selection.tributes, ownMonster.cardId];
      return { selection: { ...selection, tributes: picked } };
    }
    if (!summonZones(view, selection.tributes).includes(slot.zone)) return { selection };
    return {
      selection: null,
      action: {
        type: selection.set ? "SET_MONSTER" : "SUMMON_CARD",
        cardId: selection.cardId,
        tributeCardIds: [...selection.tributes],
        zone: slot.zone,
      },
    };
  }

  if (selection?.kind === "attack" && slot.side === "opponent" && slot.kind === "monster") {
    if (!view.opponent.monsters[slot.zone]) return { selection };
    return { selection: null, action: { type: "ATTACK", attackerCardId: selection.attackerCardId, targetZone: slot.zone } };
  }

  if (selection?.kind === "spellTarget" && slot.side === selection.side && slot.kind === "monster") {
    const monsters = slot.side === "you" ? view.you.monsters : view.opponent.monsters;
    if (!monsters[slot.zone]) return { selection };
    return { selection: null, action: { type: "ACTIVATE_SPELL", cardId: selection.cardId, targetZone: slot.zone } };
  }

  if (ownMonster) return { selection: { kind: "monster", zone: slot.zone } };
  if (slot.side === "you" && slot.kind === "spellTrap") {
    const card = view.you.spellTraps[slot.zone];
    if (card) return { selection: { kind: "field", cardId: card.cardId } };
  }
  return { selection: null };
};

/** Chaves dos slots a destacar na mesa para a seleção atual. */
export const highlightKeys = (view: PlayerView, selection: Selection | null): string[] => {
  if (!selection) return [];
  const monsterKeys = (side: "you" | "opponent"): string[] =>
    (side === "you" ? view.you.monsters : view.opponent.monsters).flatMap((m, zone) =>
      m ? [slotKey(side, "monster", zone)] : [],
    );
  switch (selection.kind) {
    case "monster":
      return [slotKey("you", "monster", selection.zone)];
    case "field": {
      const zone = view.you.spellTraps.findIndex((s) => s?.cardId === selection.cardId);
      return zone === -1 ? [] : [slotKey("you", "spellTrap", zone)];
    }
    case "attack":
      return monsterKeys("opponent");
    case "spellTarget":
      return monsterKeys(selection.side);
    case "summon":
      return selection.tributes.length < summonNeeded(selection.cardId)
        ? monsterKeys("you")
        : summonZones(view, selection.tributes).map((zone) => slotKey("you", "monster", zone));
    case "hand":
      return [];
  }
};

/** Orientação em português para o passo atual. */
export const selectionHint = (view: PlayerView, selection: Selection | null): string => {
  if (view.winner !== null) return "";
  const pending = view.pendingResponse;
  if (pending) return pending.canRespond ? TRIGGER_LABELS[pending.trigger] : "Aguardando a resposta do oponente...";
  if (view.currentPlayer !== view.viewer) return "Turno do oponente.";
  if (!selection) return "Clique em uma carta da mão ou em um monstro seu.";
  switch (selection.kind) {
    case "hand":
      return isMain(view) ? "Escolha o que fazer com a carta." : "Só é possível jogar cartas nas fases Principais.";
    case "field":
      return "Magia baixada: ative-a ou cancele.";
    case "monster":
      return "Escolha uma ação para o monstro.";
    case "attack":
      return opponentHasMonsters(view)
        ? "Clique no monstro do oponente que será atacado."
        : "O oponente não tem monstros: faça um ataque direto.";
    case "spellTarget":
      return selection.side === "you" ? "Clique no seu monstro alvo da magia." : "Clique no monstro do oponente alvo da magia.";
    case "summon": {
      const left = summonNeeded(selection.cardId) - selection.tributes.length;
      return left > 0
        ? `Clique em ${left} monstro(s) seu(s) para tributar.`
        : "Clique na zona de monstro (destacada) onde o monstro entrará.";
    }
  }
};
