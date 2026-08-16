/* Riddhi Siddhi Fabricator — Persistent 3D Background Scrubber
   The canvas is position:fixed, covering the full viewport at all times.
   Scroll progress across the ENTIRE page drives the frame index.
   The window animation is the environment, not a section. */

const canvas = document.getElementById("film");
const ctx = canvas.getContext("2d");
const loader = document.getElementById("loader");
const loadbar = document.getElementById("loadbar");

const KEEP = 120;
const AHEAD = 30;

const state = {
  blobs: [],
  bitmaps: new Map(),
  count: 0,
  pattern: "",
  current: -1,
  target: 0,
  smooth: 0,
  dir: 1,
  ready: false,
  decoding: new Set(),
};

/* ── loading ───────────────────────────────────────────── */

async function loadManifest() {
  const res = await fetch("frames/frames.json");
  if (!res.ok) throw new Error("no manifest");
  return res.json();
}

function frameURL(i) {
  return state.pattern.replace("%04d", String(i + 1).padStart(4, "0"));
}

async function fetchBlob(i) {
  if (state.blobs[i]) return state.blobs[i];
  const res = await fetch(frameURL(i));
  state.blobs[i] = await res.blob();
  return state.blobs[i];
}

async function decode(i) {
  if (state.bitmaps.has(i) || state.decoding.has(i) || !state.blobs[i]) return;
  state.decoding.add(i);
  try {
    const bmp = await createImageBitmap(state.blobs[i]);
    state.bitmaps.set(i, bmp);
  } catch { /* retried next tick */ }
  state.decoding.delete(i);
}

function manageWindow(center) {
  for (let d = 0; d <= AHEAD; d++) {
    const fwd = center + d * state.dir;
    const back = center - Math.min(d, 8) * state.dir;
    if (fwd >= 0 && fwd < state.count) decode(fwd);
    if (back >= 0 && back < state.count) decode(back);
  }
  if (state.bitmaps.size > KEEP * 2) {
    for (const [idx, bmp] of state.bitmaps) {
      if (Math.abs(idx - center) > KEEP) {
        bmp.close();
        state.bitmaps.delete(idx);
      }
    }
  }
}

async function preload() {
  const { count } = state;
  const EAGER = Math.min(Math.ceil(count * 0.15), 80);

  let done = 0;
  await Promise.all(
    Array.from({ length: EAGER }, (_, i) =>
      fetchBlob(i).then(() => {
        done++;
        if (loadbar) loadbar.style.width = `${(done / EAGER) * 100}%`;
      })
    )
  );
  await decode(0);
  state.ready = true;
  if (loader) loader.classList.add("done");

  let next = EAGER;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < count) {
        const i = next++;
        try { await fetchBlob(i); } catch {}
      }
    })
  );
}

/* ── drawing ───────────────────────────────────────────── */

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  state.current = -1;
}

function nearestDecoded(i) {
  if (state.bitmaps.has(i)) return i;
  for (let d = 1; d < state.count; d++) {
    if (state.bitmaps.has(i - d)) return i - d;
    if (state.bitmaps.has(i + d)) return i + d;
  }
  return -1;
}

function drawFrame(i) {
  const j = nearestDecoded(i);
  if (j < 0) return;
  const bmp = state.bitmaps.get(j);
  const cw = canvas.width, ch = canvas.height;

  const aspectCanvas = cw / ch;
  const aspectBmp = bmp.width / bmp.height;

  ctx.fillStyle = "#0E0709";
  ctx.fillRect(0, 0, cw, ch);

  if (aspectCanvas < aspectBmp) {
    // ── MOBILE / TALL VIEWPORT: AMBIENT BACKGROUND SYSTEM ──

    // 1. LAYER 1: AMBIENT BLURRED BACKGROUND (Same frame, overscaled & blurred)
    const sCover = Math.max(cw / bmp.width, ch / bmp.height) * 1.18;
    const wCover = bmp.width * sCover;
    const hCover = bmp.height * sCover;

    ctx.save();
    if ("filter" in ctx) {
      ctx.filter = "blur(45px) brightness(0.55) saturate(1.05)";
    }
    ctx.drawImage(bmp, (cw - wCover) / 2, (ch - hCover) / 2, wCover, hCover);
    ctx.restore();

    // 2. LAYER 1.5: SOFT GRADIENT VIGNETTE FOR CONTENT CONTRAST
    const gTop = ctx.createLinearGradient(0, 0, 0, ch * 0.35);
    gTop.addColorStop(0, "rgba(14, 7, 9, 0.65)");
    gTop.addColorStop(1, "rgba(14, 7, 9, 0)");
    ctx.fillStyle = gTop;
    ctx.fillRect(0, 0, cw, ch * 0.35);

    const gBot = ctx.createLinearGradient(0, ch * 0.65, 0, ch);
    gBot.addColorStop(0, "rgba(14, 7, 9, 0)");
    gBot.addColorStop(1, "rgba(14, 7, 9, 0.65)");
    ctx.fillStyle = gBot;
    ctx.fillRect(0, ch * 0.65, cw, ch * 0.35);

    // 3. LAYER 2: SHARP 16:9 FOREGROUND VIDEO WITH SOFT EDGE BLENDING
    const s = Math.min(cw / bmp.width, ch / bmp.height) * 1.02;
    const w = bmp.width * s, h = bmp.height * s;
    const x = (cw - w) / 2, y = (ch - h) / 2;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
    ctx.shadowBlur = 24 * (window.devicePixelRatio || 1);
    ctx.drawImage(bmp, x, y, w, h);
    ctx.restore();
  } else {
    // ── DESKTOP / LANDSCAPE: CONTAIN-FIT OVERSCALE (UNCHANGED) ──
    const s = Math.min(cw / bmp.width, ch / bmp.height) * 1.06;
    const w = bmp.width * s, h = bmp.height * s;
    ctx.drawImage(bmp, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  state.current = j;
}

/* ── scroll → frame mapping (entire page) ─────────────── */

function progress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

/* ── main loop ─────────────────────────────────────────── */

let lastT = performance.now();
function tick(now) {
  const dt = Math.min((now - lastT) / 1000, 0.5) || 0.016;
  lastT = now;
  if (state.ready) {
    const p = progress();
    const prevTarget = state.target;
    state.target = p * (state.count - 1);
    if (state.target !== prevTarget) state.dir = state.target >= prevTarget ? 1 : -1;
    const k = 1 - Math.exp(-dt * 14);
    state.smooth += (state.target - state.smooth) * k;
    if (Math.abs(state.target - state.smooth) < 0.5) state.smooth = state.target;
    const i = Math.round(state.smooth);
    manageWindow(i);
    if (i !== state.current) drawFrame(i);
  }
  requestAnimationFrame(tick);
}

/* ── boot ──────────────────────────────────────────────── */

function devPlaceholder(msg) {
  if (loader) loader.classList.add("done");
  state.ready = true;
  state.count = 1;
  const draw = () => {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#1A0F12");
    g.addColorStop(1, "#0E0709");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(185,168,172,0.7)";
    ctx.font = `${16 * (window.devicePixelRatio || 1)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
  };
  draw();
  window.addEventListener("resize", () => { resize(); draw(); });
  requestAnimationFrame(tick);
}

window.addEventListener("resize", resize);
resize();

loadManifest()
  .then((m) => {
    state.count = m.count;
    state.pattern = m.pattern;
    state.blobs = new Array(m.count).fill(null);
    requestAnimationFrame(tick);
    return preload();
  })
  .catch(() => devPlaceholder("Preparing your experience..."));
