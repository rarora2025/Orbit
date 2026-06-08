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

const AVATAR_PALETTE = [
  'bg-teal-200 text-teal-900', 'bg-orange-200 text-orange-900', 'bg-blue-200 text-blue-900',
  'bg-emerald-200 text-emerald-900', 'bg-purple-200 text-purple-900', 'bg-rose-200 text-rose-900',
  'bg-amber-200 text-amber-900', 'bg-cyan-200 text-cyan-900', 'bg-violet-200 text-violet-900',
];

/** Deterministic avatar background+text classes, indexed by a hash of the name. */
export function avatarClasses(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
