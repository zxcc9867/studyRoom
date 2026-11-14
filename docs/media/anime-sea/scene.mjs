// Offline video-authoring state only; not imported by the application runtime.
export function sceneAt(seconds) {
  const time = ((seconds % 24) + 24) % 24;
  const start = time >= 18 ? 18 : 6;
  const progress = (time - start) / 1.4;
  const meteor = progress > 0 && progress < 1 ? {
    x: (start === 6 ? .72 : .91) - progress * .25,
    y: (start === 6 ? .11 : .07) + progress * .20,
    opacity: Math.sin(Math.PI * progress) ** 2 * (start === 6 ? 1 : .72),
  } : null;
  return {phase: time / 24 * Math.PI * 2, meteor};
}
