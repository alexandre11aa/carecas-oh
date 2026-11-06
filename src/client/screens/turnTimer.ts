// src/client/screens/turnTimer.ts
import type { PlayerView } from "../../engine/playerView.js";
import type { PlayerId } from "../../engine/types.js";

export type TimerLevel = "normal" | "warning" | "critical";

/** Prazo do turno recebido em `match:state`, já convertido para o relógio local. */
export type TurnClock = {
  /** Instante do prazo no relógio do servidor (ms). */
  deadline: number;
  /** `serverNow - localNow` no momento do recebimento (ms): permite estimar o relógio do servidor. */
  offset: number;
};

export const WARNING_SECONDS = 10;
export const CRITICAL_SECONDS = 5;

/** Cria o relógio do turno a partir do que o servidor enviou; null se não há prazo (partida encerrada). */
export const createTurnClock = (turnDeadline: number | null | undefined, serverNow: number | undefined, localNow: number): TurnClock | null =>
  turnDeadline == null || serverNow == null ? null : { deadline: turnDeadline, offset: serverNow - localNow };

/** Segundos restantes (arredondados para cima, nunca negativos), sem depender do relógio local absoluto. */
export const secondsRemaining = (clock: TurnClock, localNow: number): number =>
  Math.max(0, Math.ceil((clock.deadline - (localNow + clock.offset)) / 1000));

/** Nível visual da contagem: alerta nos últimos 10 s, crítico nos últimos 5 s. */
export const timerLevel = (seconds: number): TimerLevel =>
  seconds <= CRITICAL_SECONDS ? "critical" : seconds <= WARNING_SECONDS ? "warning" : "normal";

/** Quem deve agir agora: o defensor com janela de resposta aberta; senão, o jogador do turno. */
export const actingPlayer = (view: Pick<PlayerView, "currentPlayer" | "pendingResponse">): PlayerId =>
  view.pendingResponse ? view.pendingResponse.responder : view.currentPlayer;

/** O turno virou por timeout: o novo estado foi gerado pelo servidor depois do prazo anterior. */
export const expiredByTimeout = (previous: TurnClock | null, serverNow: number | undefined): boolean =>
  previous !== null && serverNow !== undefined && serverNow >= previous.deadline;

/** Apelido do oponente (o primeiro da sala que não tem o apelido do jogador), ou null se ambíguo/ausente. */
export const opponentNickname = (players: readonly { nickname: string }[], ownNickname: string): string | null => {
  const others = players.filter((p) => p.nickname !== ownNickname);
  return others.length === 1 ? others[0].nickname : null;
};

/** Texto da faixa de vez. `acting` é quem deve agir; `opponent` é o apelido do oponente. */
export const turnBannerText = (viewer: PlayerId, acting: PlayerId, opponent: string | null): string =>
  acting === viewer ? "Sua vez" : `Vez de ${opponent ?? "oponente"}`;

/**
 * Aviso temporário ao receber um novo estado: "Sua vez!" em `TURN_STARTED` do jogador e "Tempo esgotado"
 * quando o turno virou depois do prazo anterior. Reconexão (`events: []`) nunca gera aviso.
 */
export const turnNotice = (
  events: readonly { type: string; player?: PlayerId }[],
  viewer: PlayerId,
  previous: TurnClock | null,
  serverNow: number | undefined,
): string | null => {
  const started = events.find((e) => e.type === "TURN_STARTED");
  if (!started) return null;
  const timeout = expiredByTimeout(previous, serverNow);
  if (started.player === viewer) return timeout ? "Tempo esgotado! Sua vez!" : "Sua vez!";
  return timeout ? "Tempo esgotado" : null;
};
