// src/client/animations/matchAudio.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMatchAudio } from "./matchAudio.js";

describe("áudio da partida", () => {
  let documentMock: EventTarget & { hidden: boolean };
  let created: ReturnType<typeof createMatchAudio>[];
  let sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended: (() => void) | null }[];
  let context: { state: string; resume: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>; decodeAudioData: ReturnType<typeof vi.fn>; createBufferSource: ReturnType<typeof vi.fn>; createGain: ReturnType<typeof vi.fn>; destination: object };
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const create = () => { const audio = createMatchAudio(); created.push(audio); return audio; };

  beforeEach(() => {
    documentMock = Object.assign(new EventTarget(), { hidden: false });
    created = [];
    sources = [];
    context = {
      state: "suspended", destination: {},
      resume: vi.fn(async () => { context.state = "running"; }),
      close: vi.fn(async () => { context.state = "closed"; }),
      decodeAudioData: vi.fn(async () => ({})),
      createBufferSource: vi.fn(() => {
        const source = { start: vi.fn(), stop: vi.fn(), connect: vi.fn((gain) => gain), disconnect: vi.fn(), onended: null };
        sources.push(source);
        return source;
      }),
      createGain: vi.fn(() => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() })),
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
    expect(fetch).toHaveBeenCalledTimes(12);
    audio.play("damage");
    await settle();
    expect(sources[0]!.start).toHaveBeenCalledOnce();
    audio.play("damage");
    await settle();
    expect(fetch).toHaveBeenCalledTimes(12);
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
});
