// src/client/animations/hudEffects.ts
// Animações GSAP do HUD. Só apresentam o que o servidor já decidiu; nunca alteram regras.
import gsap from "gsap";

/** Mostra um aviso (entra, fica, sai) e chama `done` ao terminar. `hold` em segundos; sem `fadeOut` o aviso permanece. */
export const playNotice = (target: HTMLElement, hold: number, fadeOut: boolean, done: () => void): gsap.core.Timeline => {
  gsap.killTweensOf(target);
  const timeline = gsap.timeline({ onComplete: done });
  timeline.fromTo(target, { opacity: 0, scale: 0.7, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: "back.out(2)" });
  timeline.to({}, { duration: hold });
  if (fadeOut) timeline.to(target, { opacity: 0, duration: 0.2 });
  return timeline;
};

/** Variação flutuante ("-800" / "+1000") sobre `anchor`; o elemento se remove sozinho. */
export const floatDelta = (anchor: HTMLElement, text: string, className: string): void => {
  const floating = document.createElement("span");
  floating.className = `life-delta ${className}`;
  floating.textContent = text;
  anchor.append(floating);
  gsap.fromTo(
    floating,
    { opacity: 1, y: 0 },
    { opacity: 0, y: -40, duration: 1.4, ease: "power1.out", onComplete: () => floating.remove() },
  );
};

/** Anima o número e a barra de vida até `target`; `onFrame` recebe o valor corrente (inteiro). */
export const tweenLife = (holder: { value: number }, target: number, onFrame: (value: number) => void): void => {
  gsap.killTweensOf(holder);
  gsap.to(holder, { value: target, duration: 0.8, ease: "power1.inOut", onUpdate: () => onFrame(Math.round(holder.value)), onComplete: () => onFrame(target) });
};

/** Para a animação de vida e fixa o valor final. */
export const snapLife = (holder: { value: number }, target: number, onFrame: (value: number) => void): void => {
  gsap.killTweensOf(holder);
  holder.value = target;
  onFrame(target);
};

/** Realce curto de um contador (ex.: cemitério). */
export const flashCounter = (target: HTMLElement): void => {
  gsap.fromTo(target, { scale: 1.6, color: "#ffd34d" }, { scale: 1, color: "#eeeeee", duration: 0.8, ease: "power2.out", clearProps: "color,transform" });
};
