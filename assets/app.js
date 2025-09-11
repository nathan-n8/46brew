/**
 * 46brew — app.js
 * - Light mode default + Dark toggle (persisted)
 * - Specs panel (single row; grind icon via Font Awesome)
 * - Coffee/Water specs auto-sync with inputs
 * - Pouring Timeline (Start only, whole-number %)
 * - Timeline subheader: “Taste: … • Body: … • Water: …”
 * - Sticky Stopwatch with Start/Pause/Reset, Sound, row highlighting, beeps at pour starts
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

// Stopwatch refs
const swDisplay = document.getElementById('sw-display');
const swNext    = document.getElementById('sw-next');
const swStart   = document.getElementById('sw-start');
const swReset   = document.getElementById('sw-reset');
const swSound   = document.getElementById('sw-sound');

// Stopwatch state
let swRunning = false;
let swStartMs = 0;      // timestamp when started (ms)
let swHeldMs  = 0;      // accumulated paused time (ms)
let swTimerId = null;
let audioCtx  = null;
let lastBeepAtSec = null;

// timeline starts cached so stopwatch can react
let cachedStartsSec = [];   // e.g. [0,45,90,...]
let cachedPourTo    = []; 
let totalWaterCached = 0;

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

// ===== Stopwatch helpers =====
function elapsedMs() {
  return swRunning ? (Date.now() - swStartMs + swHeldMs) : swHeldMs;
}
function formatMMSS(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function nextPourInfo(elSec) {
  for (let i = 0; i < cachedStartsSec.length; i++) {
    if (cachedStartsSec[i] >= elSec) {
      const diff = cachedStartsSec[i] - elSec;
      return { index: i + 1, at: cachedStartsSec[i], in: diff };
    }
  }
  const diff = Math.max(0, REMOVE_AT - elSec);
  return { index: 'Remove dripper', at: REMOVE_AT, in: diff };
}
function updateStopwatchHints(ms) {
  if (!swDisplay || !swNext) return;
  swDisplay.textContent = formatMMSS(ms);

  const elSec = Math.floor(ms / 1000);
  const info  = nextPourInfo(elSec);
  const inS   = `${info.in}s`;

  if (typeof info.index === 'number') {
    // “Pour to” is the cumulative after this pour (#index)
    const pourTo = cachedPourTo?.[info.index - 1];
    swNext.textContent = (Number.isFinite(pourTo))
      ? `Next, Pour to ${pourTo} g (in ${inS})`
      : `Next, Pour #${info.index} (in ${inS})`;
  } else {
    // Final cue (e.g., Remove dripper)
    swNext.textContent = `Next, ${info.index} (in ${inS})`;
  }

  highlightCurrentPour(elSec);
}
function highlightCurrentPour(elSec) {
  // Determine current pour: last start <= elapsed
  let idx = -1;
  for (let i = 0; i < cachedStartsSec.length; i++) {
    if (cachedStartsSec[i] <= elSec) idx = i; else break;
  }
  const cells = Array.from(document.querySelectorAll('#timeline .row'));
  cells.forEach(c => c.classList.remove('is-current'));
  if (idx < 0) return;
  // Each pour row = 5 cells; headers are not .row
  const start = idx * 5;
  for (let j = start; j < start + 5 && j < cells.length; j++) {
    cells[j].classList.add('is-current');
  }
}
function beep() {
  if (!swSound?.checked) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.001;
    o.connect(g); g.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    o.start(now);
    o.stop(now + 0.15);
  } catch {}
}
function tick() {
  const ms = elapsedMs();
  updateStopwatchHints(ms);
  const elSec = Math.floor(ms / 1000);
  if (cachedStartsSec.includes(elSec) && elSec !== lastBeepAtSec) {
    lastBeepAtSec = elSec;
    beep();
  }
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

  // Cache starts and cumulative “pour to” amounts
  cachedStartsSec = starts.slice();
  cachedPourTo = (() => {
    let cum = 0, out = [];
    for (const g of pours) { cum += g; out.push(cum); }
    return out;
  })();
  totalWaterCached = rounded;

  renderTimeline(pours, starts, rounded);
  updateStopwatchHints(elapsedMs());
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
    <div class="row muted">${mmss(REMOVE_AT)}</div>
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

// Stopwatch controls
swStart?.addEventListener('click', () => {
  if (!swRunning) {
    // start
    swRunning = true;
    swStartMs = Date.now();
    swStart.setAttribute('aria-pressed', 'true');
    swStart.textContent = 'Pause';
    if (!swTimerId) swTimerId = setInterval(tick, 200);
    // prime audio after user gesture
    if (swSound?.checked && !audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
  } else {
    // pause — accumulate elapsed BEFORE stopping
    const now = Date.now();
    swHeldMs += now - swStartMs;
    swRunning = false;
    swStart.setAttribute('aria-pressed', 'false');
    swStart.textContent = 'Start';
  }
  tick();
});

swReset?.addEventListener('click', () => {
  swRunning = false;
  swHeldMs = 0;
  lastBeepAtSec = null;
  swStart.setAttribute('aria-pressed', 'false');
  swStart.textContent = 'Start';
  updateStopwatchHints(0);
});

document.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); swStart?.click(); }
  if (e.key.toLowerCase() === 'r') { e.preventDefault(); swReset?.click(); }
});

// ===== Init =====
(function init() {
  // Theme
  const saved = localStorage.getItem(THEME_KEY);
  setTheme(saved === 'dark' ? 'dark' : 'light');

  // Buttons
  updateTasteUI(getTaste());
  updateBodyUI(getBody());

  // Stopwatch interval
  if (!swTimerId) swTimerId = setInterval(tick, 200);

  // First paint
  render();
})();