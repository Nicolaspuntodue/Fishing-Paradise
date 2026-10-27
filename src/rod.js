// Rod builder: technique + length -> guide layout and a WhatsApp message for Manuel.
export const PHONE = '393894620058';

export const TECH = {
  surf: { label: 'surf casting', min: 4.2, max: 4.8, def: 4.5, perMetre: 1.5 },
  bolo: { label: 'bolognese', min: 5, max: 8, def: 7, perMetre: 1.1 },
  trota: { label: 'trota lago', min: 3.9, max: 6, def: 4.5, perMetre: 1.6 },
  spin: { label: 'spinning da kayak', min: 1.8, max: 2.7, def: 2.1, perMetre: 3.3 },
};

export const THREADS = {
  nere: '#111111',
  arancio: '#ff5a1f',
  gialle: '#ffd21f',
  'color acqua': '#3fc4b4',
  blu: '#1e5fa8',
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function guideCount(tech, len) {
  const t = TECH[tech];
  return Math.round(clamp(len, t.min, t.max) * t.perMetre) + 1;
}

// Positions along the blank, 0 = butt, 1 = tip. Gaps shrink geometrically toward the tip,
// the first guide sits past the handle (28% of the length).
export function guidePositions(tech, len) {
  const n = guideCount(tech, len);
  const r = 0.86;
  const gaps = Array.from({ length: n - 1 }, (_, i) => r ** i);
  const total = gaps.reduce((a, b) => a + b, 0);
  const pos = [0.28];
  for (const g of gaps) pos.push(pos[pos.length - 1] + (g / total) * 0.72);
  pos[n - 1] = 1;
  return pos;
}

export function whatsappLink(tech, len, thread) {
  const t = TECH[tech];
  const l = clamp(len, t.min, t.max).toFixed(1).replace('.', ',');
  const text = `Ciao Manuel, vorrei far montare una canna da ${t.label} da ${l} m, ${guideCount(tech, len)} anelli, legature ${thread}. Si può fare?`;
  return `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
}
