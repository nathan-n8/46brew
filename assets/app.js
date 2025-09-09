/**
 * 46brew — app.js
 * - Specs in one row; Grind icon via Font Awesome (fa-braille)
 * - Subtitle under H1
 * - Timeline subheader: “Taste: … • Body: … • Water: …”
 * - Footer removed in HTML
 * - Light mode default + Dark toggle (persisted)
 * - Coffee/Water specs auto-sync with inputs
 * - Pouring Timeline (Start only, whole-number %)
 * - P1/P2 depend on Taste; later pours depend on Body with fixed start times
 */

// ===== Config =====
const DEFAULT_RATIO = 15; // 1:15

// Fixed timings (seconds)
const DUR_P1 = 15;           // 0:00 → 0:15
const GAP_P1_P2 = 30;        // 0:15 → 0:45
const DUR_P2 = 15;           // 0:45 → 1:00
const REMOVE_AT = 210;       // 3:30

const THEME_KEY = 'theme';
const TASTE_KEY = 'taste';   // 'basic' | 'sweet' | 'acid'
const BODY_KEY  = 'body';    // 'basic' | 'stronger' | 'lighter'

// ===== DOM =====
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const coffeeInput    = $('#coffee');
const resultBox      = $('#result');
const timelineBox    = $('#timeline');
const timelineSub    = $('#timeline-sub');
const themeToggleBtn = $('#theme-toggle');

// Specs values
const specCoffee = $('#spec-coffee');
const specWater  = $('#spec-water');

// Buttons
const tasteButtons = $$('[data-taste]');
const bodyButtons  = $$('[data-body]');

// ===== Theme handling =====
function setTheme(theme) {
  const html = document.documentElement;
  html.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  if (themeToggleBtn) {
    const dark = theme === 'dark';
    themeToggleBtn.setAttribute('aria-pressed', String(dark));
    themeToggleBtn.textContent = dark ? '🌞 Light' : '🌙 Dark';
    themeToggleBtn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  }
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  setTheme(saved === 'dark' ? 'dark' : 'light'); // default light
}
themeToggleBtn?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current === 'light' ? 'dark' : 'light');
});

// ===== Taste helpers =====
function getTaste() {
  const saved = localStorage.getItem(TASTE_KEY);
  return saved === 'sweet' || saved === 'acid' ? saved : 'basic';
}
function setTaste(t) { localStorage.setItem(TASTE_KEY, t); }
function updateTasteUI(active) {
  tasteButtons.forEach(btn => {
    const on = btn.dataset.taste === active;
    btn.classList.toggle('is-selected', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}
function tasteLabel(t) {
  return t === 'sweet' ? 'Increase sweetness'
       : t === 'acid'  ? 'Increase acidity'
       : 'Basic';
}

// ===== Body helpers =====
function getBody() {
  const saved = localStorage.getItem(BODY_KEY);
  return saved === 'stronger' || saved === 'lighter' ? saved : 'basic';
}
function setBody(b) { localStorage.setItem(BODY_KEY, b); }
function updateBodyUI(active) {
  bodyButtons.forEach(btn => {
    const on = btn.dataset.body === active;
    btn.classList.toggle('is-selected', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}
function bodyLabel(b) {
  return b === 'stronger' ? 'Stronger'
       : b === 'lighter'  ? 'Lighter'
       : 'Basic';
}

// ===== Utils =====
function mmss(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// ===== Plan (P1/P2 fixed; later pours per Body, fixed starts) =====
function plan46(totalWater, taste, body) {
  // P1/P2 percentages based on Taste
  let p1Pct, p2Pct;
  if (taste === 'sweet') { p1Pct = 0.15; p2Pct = 0.25; }
  else if (taste === 'acid') { p1Pct = 0.25; p2Pct = 0.15; }
  else { p1Pct = 0.20; p2Pct = 0.20; }

  // Later percentages & fixed starts by Body
  let laterPcts = [];
  let laterStarts = []; // seconds
  if (body === 'basic') {
    laterPcts = [0.20, 0.20, 0.20];   // 3 pours of 20%
    laterStarts = [90, 135, 165];     // 1:30, 2:15, 2:45
  } else if (body === 'stronger') {
    laterPcts = [0.30, 0.30];         // 2 pours of 30%
    laterStarts = [90, 135];          // 1:30, 2:15
  } else { // lighter
    laterPcts = [0.60];               // 1 pour of 60%
    laterStarts = [90];               // 1:30
  }

  // Compose all percentages and convert to grams (rounded)
  const pcts = [p1Pct, p2Pct, ...laterPcts];
  let grams = pcts.map(p => Math.round(totalWater * p));

  // Ensure rounding sums to total
  const sum = grams.reduce((a,b) => a + b, 0);
  if (sum !== totalWater) grams[grams.length - 1] += (totalWater - sum);

  // Starts array: P1 at 0, P2 at 45s, then fixed later starts
  const starts = [0, DUR_P1 + GAP_P1_P2, ...laterStarts];

  return { pours: grams, starts };
}

// ===== Render =====
function render() {
  const coffee = Number(coffeeInput?.value);
  const taste  = getTaste();
  const body   = getBody();

  if (!Number.isFinite(coffee) || coffee <= 0) {
    resultBox.textContent = 'Please enter a valid coffee weight.';
    if (timelineBox) timelineBox.innerHTML = '';
    if (timelineSub) timelineSub.textContent = '';
    if (specCoffee) specCoffee.textContent = '—';
    if (specWater)  specWater.textContent  = '—';
    return;
  }

  const water   = coffee * DEFAULT_RATIO;
  const rounded = Math.round(water);

  // Update specs numeric values
  if (specCoffee) specCoffee.textContent = `${coffee}g`;
  if (specWater)  specWater.textContent  = `${rounded}g`;

  // Inline result under input
  resultBox.innerHTML = `<strong>${rounded} g</strong> of water is required.`;

  // Timeline subheader: Taste • Body • Water
  if (timelineSub) {
    timelineSub.textContent = `Taste: ${tasteLabel(taste)} • Body: ${bodyLabel(body)} • Water: ${rounded} g`;
  }

  const { pours, starts } = plan46(rounded, taste, body);
  renderTimeline(pours, starts, rounded);
}

function renderTimeline(pours, starts, totalWater) {
  if (!timelineBox) return;

  let html = `
    <div class="th">Pour #</div>
    <div class="th">Start</div>
    <div class="th">Amount</div>
    <div class="th">%</div>
    <div class="th">Pour to</div>
  `;

  let cumulative = 0;
  pours.forEach((g, i) => {
    cumulative += g;
    const pct = Math.round((g / totalWater) * 100); // whole number %

    html += `
      <div class="row">#${i + 1}</div>
      <div class="row muted">${mmss(starts[i])}</div>
      <div class="row amt">${g} g</div>
      <div class="row muted">${pct}%</div>
      <div class="row amt">${cumulative} g</div>
    `;
  });

  // Final action row: remove dripper at 3:30
  html += `
    <div class="row"><strong>Remove dripper</strong></div>
    <div class="row muted">3:30</div>
    <div class="row muted">—</div>
    <div class="row muted">—</div>
    <div class="row amt">${totalWater} g</div>
  `;

  timelineBox.innerHTML = html;
}

// ===== Events =====
coffeeInput?.addEventListener('input', render);

document.querySelectorAll('[data-taste]').forEach(btn => {
  btn.addEventListener('click', () => {
    setTaste(btn.dataset.taste);
    updateTasteUI(btn.dataset.taste);
    render();
  });
});

document.querySelectorAll('[data-body]').forEach(btn => {
  btn.addEventListener('click', () => {
    setBody(btn.dataset.body);
    updateBodyUI(btn.dataset.body);
    render();
  });
});

// ===== Init =====
(function init() {
  // Theme
  const saved = localStorage.getItem(THEME_KEY);
  setTheme(saved === 'dark' ? 'dark' : 'light');

  // Buttons
  updateTasteUI(getTaste());
  updateBodyUI(getBody());

  // First paint
  render();
})();