// src/engine/balance.test.ts
// Simulação determinística de balanceamento: um bot fixo joga todas as combinações deck x deck, nos dois lados.
import { describe, expect, it } from "vitest";
import { applyAction } from "./applyAction.js";
import { getCard } from "./cards.js";
import { createMatch } from "./createMatch.js";
import { DECKS, type DeckId } from "./decks.js";
import { requiredTributes } from "./rules/summon.js";
import { opponentOf } from "./rules/turn.js";
import type { Action, MatchState, MonsterCard, MonsterOnField, PlayerId, PlayerState } from "./types.js";

/** Partidas por confronto ordenado (P1 x P2); cada par de decks é jogado nos dois lados. */
const GAMES_PER_MATCHUP = 200;
const MAX_TURNS = 60;
const MAX_STEPS_PER_TURN = 80;
const SEED_BASE = 20240601;

const WIN_RATE_RANGE = { min: 0.45, max: 0.55 };
const MATCHUP_RANGE = { min: 0.35, max: 0.65 };

// ---------- Bot simples e fixo ----------

const monsterOf = (m: MonsterOnField | null): MonsterCard | null => {
  const card = m ? getCard(m.cardId) : undefined;
  return card?.type === "MONSTER" ? card : null;
};
const atkOf = (m: MonsterOnField): number => (monsterOf(m)?.attack ?? 0) + (m.attackBonus ?? 0);
const defOf = (m: MonsterOnField): number => monsterOf(m)?.defense ?? 0;

const zonesOf = (monsters: (MonsterOnField | null)[]): { monster: MonsterOnField; zone: number }[] =>
  monsters.flatMap((monster, zone) => (monster ? [{ monster, zone }] : []));

const bestEnemyAttack = (enemy: PlayerState): number =>
  Math.max(0, ...zonesOf(enemy.monsters).map(({ monster }) => atkOf(monster)));

/** Alvo do ataque mais valioso que o atacante vence (ou troca em desvantagem do dono); nulo se nenhum. */
const pickTarget = (attacker: MonsterOnField, enemy: PlayerState): number | null => {
  const atk = atkOf(attacker);
  let best: { zone: number; value: number } | null = null;
  for (const { monster, zone } of zonesOf(enemy.monsters)) {
    const wins =
      monster.position === "ATTACK" ? atk > atkOf(monster) || (atk === atkOf(monster) && atk <= 1200) : atk > defOf(monster);
    if (!wins) continue;
    const value = monsterOf(monster)?.attack ?? 0;
    if (!best || value > best.value) best = { zone, value };
  }
  return best ? best.zone : null;
};

type Step = { player: PlayerId; action: Action };

/** Resposta do defensor: ativa a armadilha elegível se valer a pena, senão passa. */
const respondStep = (state: MatchState): Step => {
  const window = state.pendingResponse!;
  const responder = window.responder;
  const me = state.players[responder];
  for (const [trapZone, slot] of me.spellTraps.entries()) {
    if (!slot || !slot.faceDown || slot.setOnTurn >= state.turn) continue;
    const card = getCard(slot.cardId);
    if (card?.type !== "TRAP" || card.trigger !== window.trigger) continue;
    if (card.effect.kind === "DESTROY_ATTACKER" && window.action.type === "ATTACK") {
      const attacker = state.players[state.currentPlayer].monsters[window.action.attackerZone];
      if (!attacker || (card.effect.maxAttack !== undefined && atkOf(attacker) > card.effect.maxAttack)) continue;
    }
    return { player: responder, action: { type: "ACTIVATE_TRAP", zone: trapZone } };
  }
  return { player: responder, action: { type: "PASS_RESPONSE" } };
};

/** Próxima ação de Principal (invocar, baixar armadilha, usar magia, ajustar posição); nulo quando nada resta. */
const mainStep = (state: MatchState, me: PlayerId, tried: Set<string>): Action | null => {
  const self = state.players[me];
  const enemy = state.players[opponentOf(me)];
  const enemyBest = bestEnemyAttack(enemy);
  const freeZones = self.monsters.filter((m) => m === null).length;
  const attackCapable = zonesOf(self.monsters).filter(
    ({ monster }) => monster.position === "ATTACK" && !monster.hasAttacked,
  );
  const key = (action: Action): Action | null => {
    const id = JSON.stringify(action);
    if (tried.has(id)) return null;
    tried.add(id);
    return action;
  };

  // Magias da mão, por heurística.
  for (const cardId of self.hand) {
    const card = getCard(cardId);
    if (card?.type !== "SPELL") continue;
    const effect = card.effect;
    const enemyMonsters = zonesOf(enemy.monsters);
    switch (effect.kind) {
      case "HEAL":
        if (self.lifePoints <= 7000) return key({ type: "ACTIVATE_SPELL", cardId });
        break;
      case "HEAL_PER_MONSTER": {
        const count = zonesOf(self.monsters).length;
        if (Math.min(effect.maxAmount, effect.amountPerMonster * count) >= 1000 && self.lifePoints <= 7000) {
          return key({ type: "ACTIVATE_SPELL", cardId });
        }
        break;
      }
      case "DAMAGE":
      case "DRAIN":
        return key({ type: "ACTIVATE_SPELL", cardId });
      case "DRAW":
        if (self.deck.length >= 3 && self.hand.length <= 1) return key({ type: "ACTIVATE_SPELL", cardId });
        break;
      case "BOOST_ATTACK": {
        if (state.turn <= 1) break;
        // Reforça o atacante que, com o bônus, passa a vencer um alvo que antes não vencia (ou bate direto).
        for (const { monster, zone } of attackCapable) {
          const boosted = { ...monster, attackBonus: (monster.attackBonus ?? 0) + effect.amount };
          const direct = enemyMonsters.length === 0;
          if ((direct || (pickTarget(monster, enemy) === null && pickTarget(boosted, enemy) !== null))) {
            return key({ type: "ACTIVATE_SPELL", cardId, targetZone: zone });
          }
        }
        break;
      }
      case "BOOST_ALL_ATTACK":
        if (state.turn > 1 && attackCapable.length >= 2) return key({ type: "ACTIVATE_SPELL", cardId });
        break;
      case "DESTROY_MONSTER": {
        const targets = enemyMonsters
          .filter(({ monster }) => effect.maxAttack === undefined || atkOf(monster) <= effect.maxAttack)
          .sort((a, b) => atkOf(b.monster) - atkOf(a.monster));
        if (targets[0]) return key({ type: "ACTIVATE_SPELL", cardId, targetZone: targets[0].zone });
        break;
      }
      case "BOUNCE_MONSTER": {
        const targets = [...enemyMonsters].sort((a, b) => atkOf(b.monster) - atkOf(a.monster));
        if (targets[0] && atkOf(targets[0].monster) >= 1500) {
          return key({ type: "ACTIVATE_SPELL", cardId, targetZone: targets[0].zone });
        }
        break;
      }
      case "DESTROY_SPELL_TRAP": {
        const zone = enemy.spellTraps.findIndex((s) => s !== null);
        if (zone !== -1) return key({ type: "ACTIVATE_SPELL", cardId, targetZone: zone });
        break;
      }
      case "REVIVE_MONSTER": {
        const hasTarget = self.graveyard.some((id) => {
          const g = getCard(id);
          return g?.type === "MONSTER" && g.level <= effect.maxLevel;
        });
        if (hasTarget && freeZones > 0) return key({ type: "ACTIVATE_SPELL", cardId });
        break;
      }
    }
  }

  // Armadilhas da mão: baixa todas (há zonas de sobra).
  for (const cardId of self.hand) {
    if (getCard(cardId)?.type === "TRAP" && self.spellTraps.includes(null)) {
      return key({ type: "SET_SPELL_TRAP", cardId });
    }
  }

  // Monstros em defesa que agora vencem o campo viram para ataque; em ataque que perdem, para defesa.
  if (state.phase === "MAIN_1") {
    for (const { monster, zone } of zonesOf(self.monsters)) {
      if (monster.summonedOnTurn === state.turn || monster.hasAttacked || monster.changedPositionOnTurn === state.turn) continue;
      if (monster.position === "DEFENSE" && state.turn > 1 && atkOf(monster) > enemyBest && atkOf(monster) >= defOf(monster) - 400) {
        return key({ type: monster.faceDown ? "FLIP_SUMMON" : "CHANGE_POSITION", zone });
      }
    }
  } else {
    for (const { monster, zone } of zonesOf(self.monsters)) {
      if (monster.summonedOnTurn === state.turn || monster.hasAttacked || monster.changedPositionOnTurn === state.turn) continue;
      if (monster.position === "ATTACK" && atkOf(monster) < enemyBest && defOf(monster) > atkOf(monster)) {
        return key({ type: "CHANGE_POSITION", zone });
      }
    }
  }

  // Invocação: o maior monstro possível; tributa só os mais fracos e só se compensar.
  if (!self.normalSummonUsed) {
    const options = self.hand
      .flatMap((cardId) => {
        const card = getCard(cardId);
        return card?.type === "MONSTER" ? [card] : [];
      })
      .sort((a, b) => b.attack - a.attack);
    const field = zonesOf(self.monsters).sort((a, b) => atkOf(a.monster) - atkOf(b.monster));
    for (const card of options) {
      const needed = requiredTributes(card.level);
      if (field.length < needed) continue;
      const tributes = field.slice(0, needed);
      const lost = tributes.reduce((sum, t) => sum + atkOf(t.monster), 0);
      if (needed > 0 && card.attack <= lost + 600) continue;
      const tributeZones = tributes.map((t) => t.zone);
      const zone = self.monsters.findIndex((m, i) => m === null || tributeZones.includes(i));
      if (zone === -1) continue;
      // Ataque se vence o melhor atacante inimigo; senão baixa em defesa virada.
      const strongEnough = card.attack > enemyBest || card.attack >= card.defense + 600;
      return key({ type: strongEnough ? "SUMMON_CARD" : "SET_MONSTER", cardId: card.id, tributeZones, zone });
    }
  }
  return null;
};

/** Ação seguinte do bot para o estado dado (sempre uma jogada legal ou a passagem de fase). */
const nextStep = (state: MatchState, tried: Set<string>): Step => {
  if (state.pendingResponse) return respondStep(state);
  const me = state.currentPlayer;
  const self = state.players[me];
  const enemy = state.players[opponentOf(me)];
  switch (state.phase) {
    case "DRAW":
      return { player: me, action: { type: "NEXT_PHASE" } };
    case "MAIN_1":
    case "MAIN_2": {
      const action = mainStep(state, me, tried);
      return { player: me, action: action ?? { type: state.phase === "MAIN_1" ? "NEXT_PHASE" : "END_TURN" } };
    }
    case "BATTLE": {
      if (state.turn > 1) {
        const attackers = zonesOf(self.monsters)
          .filter(({ monster }) => monster.position === "ATTACK" && !monster.hasAttacked)
          .sort((a, b) => atkOf(b.monster) - atkOf(a.monster));
        for (const { monster, zone: attackerZone } of attackers) {
          const hasEnemy = enemy.monsters.some((m) => m !== null);
          const target = hasEnemy ? pickTarget(monster, enemy) : -1;
          if (target === null) continue;
          const action: Action = { type: "ATTACK", attackerZone, targetZone: target === -1 ? null : target };
          const id = JSON.stringify(action) + state.turn;
          if (tried.has(id)) continue;
          tried.add(id);
          return { player: me, action };
        }
      }
      return { player: me, action: { type: "NEXT_PHASE" } };
    }
    default:
      return { player: me, action: { type: "END_TURN" } };
  }
};

/** Joga a partida até o fim; devolve o vencedor ou nulo se estourar o limite de turnos. */
const playMatch = (seed: number, decks: Record<PlayerId, DeckId>): PlayerId | null => {
  let state = createMatch(seed, decks);
  let tried = new Set<string>();
  let turn = state.turn;
  let steps = 0;
  while (!state.winner && state.turn <= MAX_TURNS) {
    if (state.turn !== turn) {
      turn = state.turn;
      tried = new Set();
      steps = 0;
    }
    const { player, action } = nextStep(state, tried);
    const result = applyAction(state, player, action);
    steps++;
    if (!result.ok) {
      // Jogada inesperadamente ilegal: segue o fluxo (passar fase/turno) para nunca travar.
      const fallback = applyAction(state, player, state.pendingResponse ? { type: "PASS_RESPONSE" } : { type: state.phase === "DRAW" ? "NEXT_PHASE" : "END_TURN" });
      if (!fallback.ok) throw new Error(`Bot travou: ${action.type} -> ${result.code}`);
      state = fallback.state;
      continue;
    }
    state = result.state;
    if (steps > MAX_STEPS_PER_TURN) throw new Error("Bot excedeu o limite de passos do turno");
  }
  return state.winner;
};

// ---------- Simulação ----------

type Table = { wins: Record<string, Record<string, number>>; games: Record<string, Record<string, number>> };

/** Pontos de `a` contra `b` somando os dois lados (vitória 1, sem vencedor 0,5). */
const simulate = (gamesPerMatchup: number): Table => {
  const wins: Table["wins"] = {};
  const games: Table["games"] = {};
  for (const a of DECKS) {
    wins[a.id] = {};
    games[a.id] = {};
    for (const b of DECKS) {
      wins[a.id]![b.id] = 0;
      games[a.id]![b.id] = 0;
    }
  }
  let index = 0;
  for (const a of DECKS) {
    for (const b of DECKS) {
      for (let g = 0; g < gamesPerMatchup; g++) {
        const seed = SEED_BASE + index * 7919 + g;
        const winner = playMatch(seed, { P1: a.id, P2: b.id });
        const aPoints = winner === null ? 0.5 : winner === "P1" ? 1 : 0;
        wins[a.id]![b.id]! += aPoints;
        games[a.id]![b.id]!++;
        // Espelha para o confronto contra si mesmo não contar em duplicidade.
        if (a.id !== b.id) {
          wins[b.id]![a.id]! += 1 - aPoints;
          games[b.id]![a.id]!++;
        }
      }
      index++;
    }
  }
  return { wins, games };
};

const rate = (table: Table, a: string, b: string): number => table.wins[a]![b]! / table.games[a]![b]!;

describe("balanceamento dos decks por simulação", () => {
  const table = simulate(GAMES_PER_MATCHUP);
  const ids = DECKS.map((d) => d.id);

  it("imprime_a_tabela_de_taxas_quando_solicitado", () => {
    if (!process.env["BALANCE_REPORT"]) return;
    const rows = ids.map((a) => {
      const row = ids.map((b) => (a === b ? "  -  " : `${(rate(table, a, b) * 100).toFixed(1).padStart(5)}`));
      const others = ids.filter((b) => b !== a);
      const avg = others.reduce((s, b) => s + rate(table, a, b), 0) / others.length;
      return `${a.padEnd(11)} ${row.join(" ")} | média ${(avg * 100).toFixed(1)}%`;
    });
    process.stdout.write(`\n${"".padEnd(11)} ${ids.map((i) => i.slice(0, 5).padStart(5)).join(" ")}\n${rows.join("\n")}\n`);
  });

  it("e_deterministica_com_semente_fixa", () => {
    const first = playMatch(SEED_BASE, { P1: "aggressive", P2: "defensive" });
    expect(playMatch(SEED_BASE, { P1: "aggressive", P2: "defensive" })).toBe(first);
  });

  it("taxa_de_vitoria_media_de_cada_deck_fica_entre_45_e_55_por_cento", () => {
    for (const a of ids) {
      const others = ids.filter((b) => b !== a);
      const avg = others.reduce((sum, b) => sum + rate(table, a, b), 0) / others.length;
      expect(avg, a).toBeGreaterThanOrEqual(WIN_RATE_RANGE.min);
      expect(avg, a).toBeLessThanOrEqual(WIN_RATE_RANGE.max);
    }
  });

  it("nenhum_confronto_deck_x_deck_fica_fora_de_35_a_65_por_cento", () => {
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        expect(rate(table, a, b), `${a} x ${b}`).toBeGreaterThanOrEqual(MATCHUP_RANGE.min);
        expect(rate(table, a, b), `${a} x ${b}`).toBeLessThanOrEqual(MATCHUP_RANGE.max);
      }
    }
  });
});
