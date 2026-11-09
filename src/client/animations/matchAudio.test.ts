// src/client/animations/matchAudio.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOUND_NAMES } from "./matchFeedback.js";
import { createMatchAudio, getAppAudio, MUSIC_VOLUME, UI_SOUND_NAMES } from "./matchAudio.js";

describe("áudio da partida", () => {
  let documentMock: EventTarget & { hidden: boolean };
  let created: ReturnType<typeof createMatchAudio>[];
  let sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended: (() => void) | null }[];
  let context: { state: string; resume: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>; suspend: ReturnType<typeof vi.fn>; currentTime: number; decodeAudioData: ReturnType<typeof vi.fn>; createBufferSource: ReturnType<typeof vi.fn>; createGain: ReturnType<typeof vi.fn>; destination: object };
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const create = () => { const audio = createMatchAudio(); created.push(audio); return audio; };

  beforeEach(() => {
    documentMock = Object.assign(new EventTarget(), { hidden: false });
    created = [];
    sources = [];
    context = {
      state: "suspended", destination: {}, currentTime: 0,
      suspend: vi.fn(async () => { context.state = "suspended"; }),
      resume: vi.fn(async () => { context.state = "running"; }),
      close: vi.fn(async () => { context.state = "closed"; }),
      decodeAudioData: vi.fn(async () => ({})),
      createBufferSource: vi.fn(() => {
        const source = { start: vi.fn(), stop: vi.fn(), connect: vi.fn((gain) => gain), disconnect: vi.fn(), onended: null };
        sources.push(source);
        return source;
      }),
      createGain: vi.fn(() => ({ gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })),
    };
    vi.stubGlobal("document", documentMock);
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => null), setItem: vi.fn() });
    vi.stubGlobal("AudioContext", class { constructor() { return context; } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })));
  });
  afterEach(() => { created.forEach((audio) => audio.dispose()); vi.unstubAllGlobals(); });

  it("nao_carrega_nem_toca_antes_do_gesto_e_reutiliza_os_buffers_depois", async () => {
    const audio = create();
    audio.play("damage");
    expect(fetch).not.toHaveBeenCalled();
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    expect(fetch).toHaveBeenCalledTimes(SOUND_NAMES.length);
    audio.play("damage");
    await settle();
    expect(sources[0]!.start).toHaveBeenCalledOnce();
    audio.play("damage");
    await settle();
    expect(fetch).toHaveBeenCalledTimes(SOUND_NAMES.length);
    expect(sources).toHaveLength(2);
  });

  it("silenciar_interrompe_vozes_e_persiste_a_preferencia", async () => {
    const audio = create();
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    audio.play("attack");
    await settle();
    audio.setEnabled(false);
    expect(sources[0]!.stop).toHaveBeenCalledOnce();
    expect(localStorage.setItem).toHaveBeenCalledWith("carecas-oh:sound", "off");
    audio.play("damage");
    await settle();
    expect(sources).toHaveLength(1);
  });

  it("reconexao_cancela_reproducao_que_aguarda_buffer", async () => {
    const audio = create();
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    audio.play("damage");
    audio.stop();
    await settle();
    expect(sources).toHaveLength(0);
  });

  it("aba_oculta_e_tela_destruida_nao_reproduzem_sons", async () => {
    const audio = create();
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    documentMock.hidden = true;
    audio.play("draw");
    documentMock.hidden = false;
    audio.dispose();
    audio.play("damage");
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    expect(sources).toHaveLength(0);
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("falha_de_download_nao_interrompe_a_partida", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const audio = create();
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    audio.play("damage");
    await settle();
    expect(sources).toHaveLength(0);
  });

  it("limita_a_quatro_vozes_simultaneas", async () => {
    const audio = create();
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    for (let i = 0; i < 5; i++) { audio.play("damage"); await settle(); }
    expect(sources).toHaveLength(5);
    expect(sources[0]!.stop).toHaveBeenCalledOnce();
    expect(sources[4]!.start).toHaveBeenCalledOnce();
  });

  it("audio_global_e_unico_pre_carrega_sons_de_interface_e_toca_click", async () => {
    const audio = getAppAudio();
    expect(getAppAudio()).toBe(audio);
    created.push(audio);
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    expect(fetch).toHaveBeenCalledTimes(SOUND_NAMES.length + UI_SOUND_NAMES.length);
    expect(fetch).toHaveBeenCalledWith("/sounds/click.wav");
    expect(fetch).toHaveBeenCalledWith("/sounds/confirm.wav");
    audio.play("click");
    await settle();
    expect(sources).toHaveLength(1);
    expect(sources[0]!.start).toHaveBeenCalledOnce();
  });

  it("musica_so_inicia_apos_gesto_toca_em_loop_com_volume_baixo_e_carrega_so_a_faixa", async () => {
    const audio = create();
    audio.setMusic("menu");
    await settle();
    expect(fetch).not.toHaveBeenCalled();
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    expect(fetch).toHaveBeenCalledWith("/sounds/menu.ogg");
    expect(fetch).not.toHaveBeenCalledWith("/sounds/lobby.ogg");
    expect(sources).toHaveLength(1);
    expect(sources[0]!.start).toHaveBeenCalledOnce();
    expect((sources[0] as unknown as { loop: boolean }).loop).toBe(true);
    const gain = context.createGain.mock.results[0]!.value;
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(MUSIC_VOLUME, expect.any(Number));
    expect(MUSIC_VOLUME).toBeLessThan(0.35);
  });

  it("troca_de_faixa_faz_fade_da_anterior_sem_musica_duplicada_e_libera_nos", async () => {
    const audio = create();
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    audio.setMusic("menu");
    audio.setMusic("menu");
    await settle();
    expect(sources).toHaveLength(1);
    audio.setMusic("lobby");
    await settle();
    expect(sources).toHaveLength(2);
    expect(sources[0]!.stop).toHaveBeenCalledOnce();
    expect(sources[0]!.stop.mock.calls[0]![0]).toBeGreaterThan(0);
    sources[0]!.onended?.();
    expect(sources[0]!.disconnect).toHaveBeenCalledOnce();
    audio.setMusic(null);
    await settle();
    expect(sources[1]!.stop).toHaveBeenCalledOnce();
  });

  it("silenciar_para_a_musica_e_religar_retoma_a_faixa_desejada", async () => {
    const audio = create();
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    audio.setMusic("lobby");
    await settle();
    audio.setEnabled(false);
    expect(sources[0]!.stop).toHaveBeenCalledOnce();
    expect(sources[0]!.stop.mock.calls[0]).toEqual([]);
    audio.setEnabled(true);
    await settle();
    expect(sources).toHaveLength(2);
    expect(sources[1]!.start).toHaveBeenCalledOnce();
  });

  it("aba_oculta_pausa_o_contexto_e_voltar_retoma_sem_nova_faixa", async () => {
    const audio = create();
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    audio.setMusic("menu");
    await settle();
    documentMock.hidden = true;
    documentMock.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(context.suspend).toHaveBeenCalledOnce();
    documentMock.hidden = false;
    documentMock.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(context.state).toBe("running");
    expect(sources).toHaveLength(1);
  });

  it("dispose_encerra_a_musica_e_nao_deixa_ouvintes", async () => {
    const audio = create();
    documentMock.dispatchEvent(new Event("pointerdown"));
    await settle();
    audio.setMusic("menu");
    await settle();
    audio.dispose();
    expect(sources[0]!.stop).toHaveBeenCalledOnce();
    expect(sources[0]!.disconnect).toHaveBeenCalledOnce();
    audio.setMusic("lobby");
    await settle();
    expect(sources).toHaveLength(1);
  });
});
