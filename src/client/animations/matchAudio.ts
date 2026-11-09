// src/client/animations/matchAudio.ts
// Áudio opcional: desbloqueio por gesto, cache, limite de vozes e descarte.
// Também serve de áudio global do app (`getAppAudio`): uma instância única que sobrevive à troca de tela.
import { SOUND_NAMES, type SoundName } from "./matchFeedback.js";

const STORAGE_KEY = "carecas-oh:sound";

/** Efeitos da interface fora da partida: clique comum e confirmação (criar, entrar, pronto). */
export const UI_SOUND_NAMES = ["click", "confirm"] as const;
export type UiSoundName = typeof UI_SOUND_NAMES[number];
export type AudioName = SoundName | UiSoundName;

export const createMatchAudio = (names: readonly AudioName[] = SOUND_NAMES) => {
  let enabled = true;
  try { enabled = localStorage.getItem(STORAGE_KEY) !== "off"; } catch { /* Sem armazenamento, vale a escolha desta tela. */ }
  let context: AudioContext | null = null;
  let disposed = false;
  let generation = 0;
  const buffers = new Map<AudioName, Promise<AudioBuffer | null>>();
  const voices = new Set<AudioBufferSourceNode>();
  const load = (name: AudioName): Promise<AudioBuffer | null> => {
    const audio = context;
    if (!audio) return Promise.resolve(null);
    let pending = buffers.get(name);
    if (!pending) {
      pending = fetch(`/sounds/${name}.wav`).then((response) => response.ok ? response.arrayBuffer() : null)
        .then((data) => data ? audio.decodeAudioData(data) : null).catch(() => null);
      buffers.set(name, pending);
    }
    return pending;
  };
  const unlock = () => {
    if (disposed || !enabled) return;
    try {
      context ??= new AudioContext();
      void context.resume().then(() => {
        if (!disposed && enabled) names.forEach((name) => { void load(name); });
      }).catch(() => undefined);
    } catch { /* Falta de áudio não impede o duelo. */ }
  };
  const onKey = (event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") unlock(); };
  document.addEventListener("pointerdown", unlock, { capture: true });
  document.addEventListener("keydown", onKey, { capture: true });
  const stop = () => {
    generation++;
    for (const voice of voices) { try { voice.stop(); } catch { /* Já encerrada. */ } }
    voices.clear();
  };
  return {
    isEnabled: () => enabled,
    setEnabled: (value: boolean) => {
      enabled = value;
      try { localStorage.setItem(STORAGE_KEY, value ? "on" : "off"); } catch { /* Preferência apenas em memória. */ }
      if (value) unlock(); else stop();
    },
    play: (name: AudioName | null) => {
      if (!name || !enabled || disposed || document.hidden || context?.state !== "running") return;
      const expected = generation;
      // Não repete um som atrasado: o primeiro carregamento serve aos próximos eventos.
      const started = performance.now();
      void load(name).then((buffer) => {
        if (!buffer || !enabled || disposed || document.hidden || expected !== generation || context?.state !== "running" || performance.now() - started > 180) return;
        if (voices.size >= 4) {
          const oldest = voices.values().next().value;
          oldest?.stop();
          if (oldest) voices.delete(oldest);
        }
        const voice = context.createBufferSource();
        const gain = context.createGain();
        gain.gain.value = 0.35;
        voice.buffer = buffer;
        voice.connect(gain).connect(context.destination);
        voice.onended = () => { voices.delete(voice); voice.disconnect(); gain.disconnect(); };
        voices.add(voice);
        voice.start();
      });
    },
    stop,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      stop();
      document.removeEventListener("pointerdown", unlock, { capture: true });
      document.removeEventListener("keydown", onKey, { capture: true });
      buffers.clear();
      void context?.close().catch(() => undefined);
    },
  };
};

export type MatchAudio = ReturnType<typeof createMatchAudio>;

let appAudio: MatchAudio | null = null;

/** Áudio único do app (partida, menu e lobby): preferência e vozes compartilhadas entre telas. */
export const getAppAudio = (): MatchAudio => (appAudio ??= createMatchAudio([...SOUND_NAMES, ...UI_SOUND_NAMES]));
