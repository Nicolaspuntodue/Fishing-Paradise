import assert from 'node:assert/strict';
import { TECH, guideCount, guidePositions, whatsappLink } from './rod.js';

for (const tech of Object.keys(TECH)) {
  const { min, max } = TECH[tech];
  for (const len of [min, (min + max) / 2, max, max + 5]) {
    const p = guidePositions(tech, len);
    assert.equal(p.length, guideCount(tech, len));
    assert.equal(p[0], 0.28);
    assert.equal(p.at(-1), 1);
    for (let i = 1; i < p.length; i++) assert.ok(p[i] > p[i - 1], `${tech} ${len} ascending`);
  }
}
assert.equal(guideCount('bolo', 7), 9);
assert.equal(guideCount('bolo', 99), guideCount('bolo', 8)); // clamped

const url = whatsappLink('surf', 4.5, 'arancio');
assert.ok(url.startsWith('https://wa.me/393894620058?text='));
const msg = decodeURIComponent(url.split('text=')[1]);
assert.match(msg, /surf casting da 4,5 m, 8 anelli, legature arancio/);
console.log('rod ok');
