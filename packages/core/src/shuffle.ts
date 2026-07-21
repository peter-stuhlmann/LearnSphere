/**
 * Fisher-Yates-Shuffle mit injizierbarem Zufall (rein & testbar).
 * Aufrufer geben Math.random (Server-Request) oder einen Seed-RNG (Tests).
 */
export function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
