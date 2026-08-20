/**
 * Deterministic, dependency-free avatar art. Produces an inline SVG data URI so
 * demo profiles and placeholder states look designed without any network fetch.
 */

const PALETTES = [
  ["#6c4cff", "#b388ff", "#d8ff57"],
  ["#ff6b5a", "#ffd166", "#fff3d6"],
  ["#0ea5e9", "#4cc9f0", "#e0fbff"],
  ["#2f855a", "#9ae6b4", "#f0fff4"],
  ["#f43f5e", "#fb7185", "#ffe4e6"],
  ["#7c3aed", "#22d3ee", "#0b1020"],
  ["#f59e0b", "#84cc16", "#1c1917"],
  ["#111827", "#6b7280", "#e5e7eb"],
];

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function generatedAvatar(seed: string, initials = "") {
  const h = hash(seed);
  const [a, b, c] = PALETTES[h % PALETTES.length];
  const angle = h % 360;
  const cx = 30 + (h % 40);
  const cy = 25 + ((h >> 3) % 40);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<defs><linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs>
<rect width="120" height="120" fill="url(#g)"/>
<circle cx="${cx}" cy="${cy}" r="34" fill="${c}" opacity="0.55"/>
<circle cx="${120 - cx}" cy="${110 - cy}" r="22" fill="${c}" opacity="0.35"/>
${initials ? `<text x="60" y="60" text-anchor="middle" dominant-baseline="central" font-family="Inter, system-ui, sans-serif" font-size="42" font-weight="700" fill="#fff" opacity="0.92">${initials}</text>` : ""}
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function generatedCover(seed: string) {
  const h = hash(seed + "cover");
  const [a, b, c] = PALETTES[h % PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs>
<rect width="400" height="200" fill="url(#g)"/>
<circle cx="${h % 400}" cy="${(h >> 4) % 200}" r="90" fill="${c}" opacity="0.4"/>
<circle cx="${(h >> 8) % 400}" cy="${(h >> 6) % 200}" r="60" fill="#fff" opacity="0.14"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
