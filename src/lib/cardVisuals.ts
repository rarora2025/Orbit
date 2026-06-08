const GRADIENTS: [string, string][] = [
  ['#1e3a8a', '#3b82f6'],
  ['#7c2d12', '#ea580c'],
  ['#134e4a', '#14b8a6'],
  ['#4c1d95', '#8b5cf6'],
  ['#831843', '#ec4899'],
  ['#064e3b', '#10b981'],
  ['#713f12', '#f59e0b'],
  ['#1e1b4b', '#6366f1'],
];

/** Deterministic per-contact banner gradient, indexed by a hash of the name. */
export function bannerGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const [from, to] = GRADIENTS[Math.abs(hash) % GRADIENTS.length];
  return `linear-gradient(120deg, ${from}, ${to})`;
}
