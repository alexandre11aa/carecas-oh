// src/client/screens/cardDetail.ts
import { getCard } from "../../engine/cards.js";
import type { PlayerView } from "../../engine/playerView.js";
import type { SpellEffect } from "../../engine/types.js";
import type { Slot } from "../scene/layout.js";

export type CardKind = "monster" | "spell" | "trap";

/** Textos prontos de uma carta para exibição (rótulos em português). */
export type CardDetail = {
  id: string;
  kind: CardKind;
  name: string;
  typeLabel: string;
  /** "ATK 1600 / DEF 1200" para monstros; null nas demais. */
  stats: string | null;
  /** Efeito da carta (`description`). */
  effect: string;
  /** Mecânica da carta (`flavor`). */
  mechanic: string;
};

const TYPE_LABELS = { SPELL: "Magia", TRAP: "Armadilha" } as const;

/** Monta os textos da carta; devolve null para carta oculta (`null`) ou desconhecida. */
export const buildCardDetail = (cardId: string | null | undefined): CardDetail | null => {
  if (!cardId) return null;
  const card = getCard(cardId);
  if (!card) return null;
  const base = { id: card.id, name: card.name, effect: card.description, mechanic: card.flavor };
  if (card.type === "MONSTER") {
    return { ...base, kind: "monster", typeLabel: `Monstro · Nível ${card.level}`, stats: `ATK ${card.attack} / DEF ${card.defense}` };
  }
  return { ...base, kind: card.type === "SPELL" ? "spell" : "trap", typeLabel: TYPE_LABELS[card.type], stats: null };
};

/** Id da carta visível num slot da mesa; null para slot vazio, deck ou carta oculta do oponente. */
export const slotCardId = (view: PlayerView, slot: Slot): string | null => {
  const side = slot.side === "you" ? view.you : view.opponent;
  if (slot.kind === "monster") return side.monsters[slot.zone]?.cardId ?? null;
  if (slot.kind === "spellTrap") return side.spellTraps[slot.zone]?.cardId ?? null;
  if (slot.kind === "graveyard") return side.graveyard[side.graveyard.length - 1] ?? null;
  return null;
};

/** Atributos atuais de um monstro em campo, prontos para exibição. */
export type MonsterStats = {
  levelText: string;
  attackText: string;
  defenseText: string;
  /** Verdadeiro quando o ATK atual difere do base (reforço). */
  boosted: boolean;
};

/** Atributos atuais (base + `attackBonus`) de um monstro; null para carta oculta, desconhecida ou que não é monstro. */
export const buildMonsterStats = (cardId: string | null | undefined, attackBonus = 0): MonsterStats | null => {
  if (!cardId) return null;
  const card = getCard(cardId);
  if (!card || card.type !== "MONSTER") return null;
  const bonus = attackBonus;
  const sign = bonus > 0 ? "+" : "";
  return {
    levelText: `Nível ${card.level}`,
    attackText: bonus === 0 ? `ATK ${card.attack}` : `ATK ${card.attack + bonus} (${sign}${bonus})`,
    defenseText: `DEF ${card.defense}`,
    boosted: bonus !== 0,
  };
};

/** `attackBonus` do monstro visível (virado para cima) no slot; null se o slot não tem monstro visível. */
export const slotMonsterBonus = (view: PlayerView, slot: Slot): number | null => {
  if (slot.kind !== "monster") return null;
  const side = slot.side === "you" ? view.you : view.opponent;
  const monster = side.monsters[slot.zone];
  if (!monster || monster.cardId === null || monster.faceDown) return null;
  return "attackBonus" in monster ? monster.attackBonus ?? 0 : 0;
};

/** Texto de efeito e de mecânica de um efeito de magia (rótulos em português). */
export const describeSpellEffect = (effect: SpellEffect): { effect: string; mechanic: string } => {
  switch (effect.kind) {
    case "BOOST_ATTACK":
      return { effect: `Um monstro seu ganha ${effect.amount} de ATK até o fim do turno.`, mechanic: "Escolha um monstro seu no campo." };
    case "HEAL":
      return { effect: `Você recupera ${effect.amount} pontos de vida.`, mechanic: "Sem alvo." };
    case "DAMAGE":
      return { effect: `O oponente perde ${effect.amount} pontos de vida.`, mechanic: "Sem alvo." };
    case "DESTROY_MONSTER":
      return {
        effect:
          effect.maxAttack === undefined
            ? "Destrói um monstro do oponente."
            : `Destrói um monstro do oponente com ATK até ${effect.maxAttack}.`,
        mechanic: "Escolha um monstro do oponente.",
      };
    case "DRAW":
      return { effect: `Você compra ${effect.count} ${effect.count === 1 ? "carta" : "cartas"}.`, mechanic: "Sem alvo." };
    case "BOOST_ALL_ATTACK":
      return {
        effect: `Todos os seus monstros no campo ganham ${effect.amount} de ATK até o fim do turno.`,
        mechanic: "Sem alvo. Vale também para monstros virados.",
      };
    case "HEAL_PER_MONSTER":
      return {
        effect: `Você recupera ${effect.amountPerMonster} pontos de vida por monstro seu no campo, até ${effect.maxAmount}.`,
        mechanic: "Sem alvo. Sem monstros no campo, não cura nada.",
      };
    case "DESTROY_SPELL_TRAP":
      return {
        effect: "Destrói uma magia ou armadilha do oponente, mesmo virada.",
        mechanic: "Escolha uma zona de magia/armadilha do oponente. A carta vai ao cemitério dele.",
      };
    case "DRAIN":
      return {
        effect: `O oponente perde ${effect.amount} pontos de vida e você recupera ${effect.amount}.`,
        mechanic: "Sem alvo.",
      };
    case "BOUNCE_MONSTER":
      return {
        effect: "Devolve um monstro do oponente à mão dele.",
        mechanic: "Escolha um monstro do oponente. O bônus de ATK dele some.",
      };
    case "REVIVE_MONSTER":
      return {
        effect: `Traz ao campo, em ataque, o monstro de maior ATK do seu cemitério com nível ${effect.maxLevel} ou menos.`,
        mechanic: "Sem alvo. Em empate de ATK, vale o mais antigo no cemitério. Exige uma zona de monstro livre.",
      };
  }
};
