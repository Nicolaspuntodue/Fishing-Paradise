import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { TECH, THREADS, guideCount, guidePositions, whatsappLink } from './rod.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const phone = () => innerWidth <= 820;
history.scrollRestoration = 'manual';
scrollTo(0, 0);

/* ---------- smooth scroll ---------- */
let lenis;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const t = $(a.getAttribute('href'));
    if (t) { e.preventDefault(); lenis.scrollTo(t); }
  }));
}

// one resize pass per frame, whatever fires it
const onResize = (fn) => {
  let queued = false;
  addEventListener('resize', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(); });
  });
};

/* ---------- hero: the name at the waterline, the scroll sinks us under it ---------- */
const stage = $('.hero__stage');
let hero = null;
const applyHero = (p) => {
  const base = phone() ? 0.46 : 0.5;
  const line = base - p * 1.05;
  stage.style.setProperty('--shift', `${-p * 1.05 * stage.clientHeight}px`);
  $('.hero__sub').style.opacity = String(Math.max(0, 1 - p * 7));
  hero?.set(p, line);
};
const heroST = ScrollTrigger.create({
  trigger: '.hero', start: 'top top', end: 'bottom bottom',
  onUpdate: (s) => applyHero(s.progress),
  onToggle: (s) => hero?.run(s.isActive || s.progress < 1),
});

import('./water.js').then(({ initHero }) => {
  try { hero = initHero($('.hero__gl')); } catch { return; } // no WebGL: the flat fields stay
  hero.still(reduced);
  applyHero(heroST.progress);
  hero.run(heroST.progress < 1);
  onResize(() => { hero.resize(); applyHero(heroST.progress); });
});

if (!reduced) {
  gsap.timeline({ delay: 0.15 })
    .from('.hero__title .line > span', { yPercent: 110, duration: 0.9, stagger: 0.11, ease: 'expo.out' })
    .from('.hero__sub > span, .bar > *', { autoAlpha: 0, y: 16, duration: 0.7, stagger: 0.06, ease: 'power2.out' }, 0.55);
}

/* ---------- mosaic: one photograph cut across the tiles ---------- */
const grid = $('.mosaic__grid');
const IMG = { w: 1024, h: 688 }; // aspect only; both files share it
let laid = '';
function buildMosaic() {
  const key = `${grid.clientWidth}x${grid.clientHeight}`;
  if (key === laid) return;
  laid = key;
  // phones get the 1024px cut, desktop the 2K upscale
  grid.style.setProperty('--img', `url('/photos/${phone() ? 'surf' : 'surf-2k'}.webp')`);
  const want = phone() ? 16 : 24 - 7; // phone: four rows of four between the text bands
  const have = $$('.tile--photo', grid);
  if (have.length !== want) {
    have.forEach((t) => t.remove());
    for (let i = 0; i < want; i++) {
      const d = document.createElement('div');
      d.className = 'tile tile--photo';
      d.setAttribute('aria-hidden', 'true');
      grid.append(d);
    }
  }
  const gw = grid.clientWidth, gh = grid.clientHeight;
  // 12% larger than the grid, so the slow pan never shows an edge
  const k = Math.max(gw / IMG.w, gh / IMG.h) * 1.12;
  const bw = IMG.w * k, bh = IMG.h * k, ox = (gw - bw) / 2, oy = (gh - bh) / 2;
  for (const t of $$('.tile--photo', grid)) {
    // each ::before overhangs its tile by 10% (see style.css)
    const ex = t.offsetWidth * 0.1, ey = t.offsetHeight * 0.1;
    t.style.cssText = `--bw:${bw}px;--bh:${bh}px;--bx:${ox - t.offsetLeft + ex}px;--by:${oy - t.offsetTop + ey}px`;
  }
}
buildMosaic();
new ResizeObserver(buildMosaic).observe(grid);

/* ---------- the rod builder (the live thing) ---------- */
const form = $('.canna__form');
const range = $('[data-len]', form);
const sw = $('[data-thread]', form);
for (const [name, hex] of Object.entries(THREADS)) {
  sw.insertAdjacentHTML('beforeend',
    `<label title="${name}"><input type="radio" name="thread" value="${name}"${name === 'nere' ? ' checked' : ''}><span style="--c:${hex}"></span><span class="sr">${name}</span></label>`);
}
let rod = null;
const read = () => ({
  tech: $('input[name=tech]:checked', form).value,
  len: parseFloat(range.value),
  thread: $('input[name=thread]:checked', form).value,
});
const metres = (v) => `${(+v).toFixed(1).replace('.', ',')} m`;
const cap = (t) => t[0].toUpperCase() + t.slice(1);

// the segmented control's thumb glides under the chosen technique
const seg = $('.seg', form);
const thumb = $('.seg__thumb', seg);
function moveThumb() {
  const lab = $('input:checked', seg).closest('label');
  thumb.style.setProperty('--tx', `${lab.offsetLeft}px`);
  thumb.style.setProperty('--tw', `${lab.offsetWidth}px`);
}
seg.classList.add('is-still'); // first placement without travel
moveThumb();
requestAnimationFrame(() => requestAnimationFrame(() => seg.classList.remove('is-still')));

// a summary value that changes gets a small lift, so the eye catches it
function show(key, value) {
  const dd = $(`[data-s="${key}"]`, form);
  if (dd.textContent === value) return;
  dd.textContent = value;
  if (!reduced) gsap.fromTo(dd, { y: 6, opacity: 0.35 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out', overwrite: true });
}

function updateRod() {
  const { tech, len, thread } = read();
  range.parentElement.style.setProperty('--p', (len - range.min) / (range.max - range.min));
  $('[data-len-out]', form).textContent = metres(len);
  $('[data-thread-name]', form).textContent = thread;
  show('tech', $('input:checked', seg).nextElementSibling.textContent);
  show('len', metres(len));
  show('rings', String(guideCount(tech, len)));
  show('thread', cap(thread));
  $('[data-wa]', form).href = whatsappLink(tech, len, thread);
  rod?.set(guidePositions(tech, len), THREADS[thread]);
}
$$('input[name=tech]', form).forEach((r) => r.addEventListener('change', () => {
  const t = TECH[r.value];
  Object.assign(range, { min: t.min, max: t.max });
  range.value = t.def;
  $('[data-min]', form).textContent = metres(t.min);
  $('[data-max]', form).textContent = metres(t.max);
  moveThumb();
  updateRod();
}));
form.addEventListener('input', updateRod);
updateRod();

// build the rod scene while the browser is idle after load, so its shader compile never lands mid-scroll
let rodReady = null;
const loadRod = () => rodReady ??= import('./rodgl.js').then(({ initRod }) => {
  try { rod = initRod($('.canna__gl')); } catch { return; }
  document.documentElement.classList.add('has-gl');
  rod.still(reduced);
  updateRod();
  rod.draw();
  onResize(rod.resize);
});
addEventListener('load', () => (window.requestIdleCallback || setTimeout)(loadRod, { timeout: 2500 }));

ScrollTrigger.create({
  trigger: '.canna', start: 'top bottom', end: 'bottom top',
  onToggle: async (s) => {
    await loadRod();
    rod?.run(s.isActive);
  },
  onUpdate: (s) => rod?.tilt((s.progress - 0.5) * 0.9),
});

// the race clip loads and plays only while it is on screen
const clip = $('.gare__body video');
if (!reduced) {
  new IntersectionObserver(([e]) => { if (e.isIntersecting) clip.play().catch(() => {}); else clip.pause(); }, { rootMargin: '200px' }).observe(clip);
}

/* ---------- text splitting for the scroll moves ---------- */
// wraps every word of el (inline elements kept) in <span class="w">
function splitWords(el) {
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 1) { walk(n); continue; }
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const frag = document.createDocumentFragment();
      for (const part of n.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { frag.append(' '); continue; }
        const w = document.createElement('span');
        w.className = 'w';
        w.textContent = part;
        frag.append(w);
      }
      n.replaceWith(frag);
    }
  };
  walk(el);
  return $$('.w', el);
}
// letters of a heading inside per-word masks; the heading keeps its text for screen readers
function splitChars(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.innerHTML = text.split(' ').map((word) =>
    `<span class="mask" aria-hidden="true">${[...word].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`).join(' ');
  return $$('.ch', el);
}

if (!reduced) {
  /* every section title: its letters rise out of their own line */
  for (const h of $$('h2.head')) {
    h.classList.remove('reveal');
    gsap.from(splitChars(h), {
      yPercent: 115, rotate: 6, duration: 0.9, ease: 'expo.out', stagger: 0.022,
      scrollTrigger: { trigger: h, start: 'top 85%', once: true },
    });
  }

  /* "Manuel, al banco": the statement lights up word by word as it is read,
     the shop opens like a shutter and drifts, the four facts arrive in order */
  const lede = $('.about__lede');
  gsap.fromTo(splitWords(lede), { opacity: 0.18 }, {
    opacity: 1, ease: 'none', stagger: 0.1,
    scrollTrigger: { trigger: lede, start: 'top 85%', end: 'bottom 62%', scrub: 0.6 },
  });
  const pic = $('.about__pic');
  gsap.fromTo(pic, { clipPath: 'inset(100% 0% 0% 0%)' }, {
    clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
    scrollTrigger: { trigger: pic, start: 'top 92%', end: 'top 45%', scrub: 0.6 },
  });
  gsap.fromTo($('img', pic), { scale: 1.25, yPercent: -6 }, {
    scale: 1.05, yPercent: 6, ease: 'none',
    scrollTrigger: { trigger: pic, start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.from([...$$('.fact'), $('.about__cta')], {
    y: 32, autoAlpha: 0, duration: 0.9, ease: 'expo.out', stagger: 0.09,
    scrollTrigger: { trigger: '.facts', start: 'top 82%', once: true },
  });

  /* mosaic: the tiles fly in from depth and lock into one picture, which then drifts inside them */
  const tiles = $$('.tile', grid);
  gsap.from(tiles, {
    opacity: 0, scale: 0.6, z: -260,
    rotationX: () => gsap.utils.random(-55, 55), rotationY: () => gsap.utils.random(-70, 70),
    transformPerspective: 900, ease: 'power2.out',
    stagger: { each: 0.035, from: 'random' },
    scrollTrigger: { trigger: grid, start: 'top 100%', end: 'top 45%', scrub: 0.8 },
  });
  gsap.fromTo(grid, { '--px': '18px', '--py': '12px' }, {
    '--px': '-18px', '--py': '-12px', ease: 'none',
    scrollTrigger: { trigger: grid, start: 'top bottom', end: 'bottom top', scrub: true },
  });

  /* every other section: heading, then text, then picture */
  for (const sec of $$('.chapter:not(.about):not(.mosaic)')) {
    const parts = $$('.reveal, .row, .foot__top > *, .foot__big', sec).filter((e) => !e.matches('h2.head'));
    if (!parts.length) continue;
    gsap.from(parts, {
      y: 28, autoAlpha: 0, duration: 0.9, ease: 'expo.out',
      stagger: parts.length > 12 ? 0.025 : 0.08,
      scrollTrigger: { trigger: sec, start: 'top 78%', once: true },
    });
  }
  // the shop's pictures open like a shutter as they arrive
  for (const img of $$('.spec__tile img')) {
    gsap.from(img, {
      clipPath: 'inset(100% 0 0 0)', scale: 1.15, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: img, start: 'top 88%', once: true },
    });
  }
  // the trout clip drifts a little against the scroll
  gsap.fromTo('.gare__body video', { yPercent: 6 }, {
    yPercent: -6, ease: 'none',
    scrollTrigger: { trigger: '.gare__body', start: 'top bottom', end: 'bottom top', scrub: true },
  });
}

onResize(moveThumb);
document.fonts.ready.then(() => { buildMosaic(); moveThumb(); ScrollTrigger.refresh(); });
