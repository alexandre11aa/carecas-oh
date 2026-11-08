// src/engine/ai/simulation.test.ts
// Simulação determinística IA x IA: segurança (nenhuma ação inválida, todo turno e toda partida terminam)
// e comparação dos níveis, com sementes fixas, lados alternados e os 6 decks.
// Rode `BALANCE_REPORT=1 npx vitest run src/engine/ai/simulation.test.ts -t imprime` para ver a tabela.
import { describe, expect, it } from "vitest";
import { applyAction } from "../applyAction.js";
import { createMatch } from "../createMatch.js";
import { DECKS, type DeckId } from "../decks.js";
import { opponentOf } from "../rules/turn.js";
import type { Action, MatchState, PlayerId } from "../types.js";
import { chooseAiAction } from "./choose.js";
import { AI_LEVELS, MAX_AI_ACTIONS_PER_TURN, type AiLevel } from "./types.js";

const MAX_TURNS = 80;
/** Cada base joga os 6 decks nos dois lados (120 partidas por par de níveis). */
const BASES = 10;
const SEED_BASE = 700000;
const deckIds: DeckId[] = DECKS.map((d) => d.id);

type Outcome = { winner: PlayerId | null; turns: number; invalid: number; maxTurnActions: number };

/** Joga uma partida; conta ações inválidas e o maior número de ações num mesmo turno (inclui respostas). */
const simulate = (seed: number, levels: Record<PlayerId, AiLevel>, decks: Record<PlayerId, DeckId>): Outcome => {
  let state: MatchState = createMatch(seed, decks);
  const seeds: Record<PlayerId, number> = { P1: seed * 2 + 1, P2: seed * 2 + 2 };
  let invalid = 0;
  let maxTurnActions = 0;
  let turnActions = 0;
  let lastTurn = state.turn;
  let steps = 0;
  while (!state.winner && state.turn <= MAX_TURNS && steps++ < MAX_TURNS * MAX_AI_ACTIONS_PER_TURN) {
    const side = state.pendingResponse ? state.pendingResponse.responder : state.currentPlayer;
    const decision = chooseAiAction({ state, side, level: levels[side], seed: seeds[side] });
    seeds[side] = decision.seed;
    const result = decision.action ? applyAction(state, side, decision.action as Action) : null;
    if (!result || !result.ok) {
      invalid++;
      break;
    }
    state = result.state;
    if (state.turn !== lastTurn) {
      lastTurn = state.turn;
      turnActions = 0;
    }
    turnActions++;
    maxTurnActions = Math.max(maxTurnActions, turnActions);
  }
  return { winner: state.winner, turns: state.turn, invalid, maxTurnActions };
};

type Tally = { a: number; b: number; draws: number; games: number; invalid: number; unfinished: number; maxTurnActions: number };

/** `a` contra `b`: em cada base, 6 decks x 2 lados (o deck do nível A é o mesmo nos dois lados). */
const compare = (a: AiLevel, b: AiLevel): Tally => {
  const tally: Tally = { a: 0, b: 0, draws: 0, games: 0, invalid: 0, unfinished: 0, maxTurnActions: 0 };
  for (let base = 0; base < BASES; base++) {
    deckIds.forEach((deckA, i) => {
      const deckB = deckIds[(i + 1 + base) % deckIds.length]!;
      for (const aSide of ["P1", "P2"] as PlayerId[]) {
        const bSide = opponentOf(aSide);
        const seed = SEED_BASE + base * 100 + i * 2 + (aSide === "P1" ? 0 : 1);
        const out = simulate(seed, { [aSide]: a, [bSide]: b } as Record<PlayerId, AiLevel>, {
          [aSide]: deckA,
          [bSide]: deckB,
        } as Record<PlayerId, DeckId>);
        tally.games++;
        tally.invalid += out.invalid;
        tally.maxTurnActions = Math.max(tally.maxTurnActions, out.maxTurnActions);
        if (!out.winner) tally.unfinished++;
        else if (out.winner === aSide) tally.a++;
        else tally.b++;
      }
    });
  }
  return tally;
};

const PAIRS: [AiLevel, AiLevel][] = [
  ["hard", "easy"],
  ["hard", "medium"],
  ["medium", "easy"],
];
const results = new Map<string, Tally>();
const resultOf = (a: AiLevel, b: AiLevel): Tally => {
  const key = `${a}-${b}`;
  if (!results.has(key)) results.set(key, compare(a, b));
  return results.get(key)!;
};

describe("simulacao IA x IA: seguranca", () => {
  it("ia_nao_joga_acao_invalida_e_toda_partida_termina_em_todo_par_de_niveis", () => {
    for (const [a, b] of PAIRS) {
      const t = resultOf(a, b);
      expect({ pair: `${a}-${b}`, invalid: t.invalid }).toEqual({ pair: `${a}-${b}`, invalid: 0 });
      expect({ pair: `${a}-${b}`, unfinished: t.unfinished }).toEqual({ pair: `${a}-${b}`, unfinished: 0 });
      expect(t.games).toBe(BASES * deckIds.length * 2);
      expect(t.a + t.b).toBe(t.games);
    }
  });

  it("ia_nao_joga_acao_invalida_em_partidas_do_mesmo_nivel", () => {
    for (const level of AI_LEVELS) {
      for (let i = 0; i < deckIds.length; i++) {
        const out = simulate(SEED_BASE + 5000 + i, { P1: level, P2: level }, { P1: deckIds[i]!, P2: deckIds[(i + 2) % 6]! });
        expect({ level, invalid: out.invalid }).toEqual({ level, invalid: 0 });
        expect({ level, ended: out.winner !== null }).toEqual({ level, ended: true });
      }
    }
  });

  it("ia_todo_turno_termina_dentro_do_limite_de_acoes", () => {
    for (const [a, b] of PAIRS) {
      expect(resultOf(a, b).maxTurnActions).toBeLessThanOrEqual(MAX_AI_ACTIONS_PER_TURN);
    }
  });
});

describe("simulacao IA x IA: comparacao dos niveis", () => {
  // Medido (10 bases x 12 partidas por par: Difícil x Fácil 86%, Difícil x Médio 58%, Médio x Fácil 75%): ver tabela com BALANCE_REPORT=1. Referência anterior em 8 bases de 20:
  // Difícil x Fácil ~89%, Difícil x Médio ~68%. Limiares com margem abaixo do medido, sobre a taxa de vitória
  // do nível maior sobre o menor (empates não existem: toda partida termina com vencedor).
  const rate = (t: Tally): number => t.a / t.games;

  it("ia_dificil_vence_a_facil_na_maioria", () => {
    expect(rate(resultOf("hard", "easy"))).toBeGreaterThanOrEqual(0.75);
  });

  it("ia_dificil_vence_o_medio_na_maioria", () => {
    expect(rate(resultOf("hard", "medium"))).toBeGreaterThanOrEqual(0.55);
  });

  it("ia_medio_vence_a_facil_na_maioria", () => {
    expect(rate(resultOf("medium", "easy"))).toBeGreaterThanOrEqual(0.55);
  });

  it.runIf(process.env.BALANCE_REPORT)("imprime_a_tabela_da_simulacao", () => {
    const rows = PAIRS.map(([a, b]) => {
      const t = resultOf(a, b);
      return `${a} x ${b}: ${t.a}-${t.b} de ${t.games} (${((t.a / t.games) * 100).toFixed(0)}%), sem fim ${t.unfinished}, invalidas ${t.invalid}, max acoes/turno ${t.maxTurnActions}`;
    });
    console.log(`\n${rows.join("\n")}`);
  });
});
