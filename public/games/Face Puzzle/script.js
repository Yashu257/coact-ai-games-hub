import { createHandTracking } from "./handTracking.js";
import { createGestureController } from "./gestureController.js";

// ── COACT Hub score bridge ─────────────────────────────────────────
async function _recordScore(gameId, score) {
  try {
    const empName = localStorage.getItem('ai_hub_employee');
    if (!empName) return;
    
    const response = await fetch('http://localhost:3001/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeName: empName, gameId, score })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('[Hub] Saved to backend', score, 'pts for', empName, '→', gameId, result);
    } else {
      console.warn('[Hub] Backend save failed with status', response.status);
    }
  } catch(e) { 
    console.warn('[Hub] Backend score bridge failed:', e.message); 
  }
}

function _recordLocalScore(gameId, score) {
  try {
    const empName = localStorage.getItem('ai_hub_employee');
    if (!empName) return;
    const empId = empName.trim().toLowerCase().replace(/\s+/g, '-');
    let store = {};
    try { store = JSON.parse(localStorage.getItem('ai_hub_scores') || '{}'); } catch(e) {}
    if (!store[empId]) store[empId] = { name: empName, games: {} };
    store[empId].name = empName;
    if (!store[empId].games[gameId]) store[empId].games[gameId] = { best: 0, attempts: 0, history: [], totalScore: 0 };
    const g = store[empId].games[gameId];
    g.attempts++;
    g.history.unshift(score);
    if (g.history.length > 10) g.history.pop();
    g.totalScore += score;
    if (score > g.best) g.best = score;
    localStorage.setItem('ai_hub_scores', JSON.stringify(store));
    console.log('[Hub] Saved locally', score, 'pts for', empName, '→', gameId);
    
    _recordScore(gameId, score);
  } catch(e) { console.warn('[Hub] Score bridge failed:', e.message); }
}
// ──────────────────────────────────────────────────────────────────

// Face Puzzle (pure HTML/CSS/JS)
// - Generates (or uploads) a face image, slices it into NxN puzzle pieces, shuffles them, and tracks time/moves/score.
// - Supports both pointer dragging (mouse/touch) and gesture dragging via MediaPipe Hands (pinch to grab).

function $(id) {
  return document.getElementById(id);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rand = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function nowMs() {
  return performance.now();
}

function safeLocalStorageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function createTonePlayer() {
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function play({ freq = 440, type = "sine", durationMs = 90, gain = 0.06 } = {}) {
    if (!enabled) return;
    const c = ensure();
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + durationMs / 1000);
  }

  return {
    setEnabled: (v) => {
      enabled = Boolean(v);
    },
    getEnabled: () => enabled,
    pick: () => play({ freq: 660, type: "triangle", durationMs: 60, gain: 0.05 }),
    drop: () => play({ freq: 520, type: "triangle", durationMs: 70, gain: 0.055 }),
    win: () => {
      play({ freq: 523.25, type: "sine", durationMs: 120, gain: 0.06 });
      setTimeout(() => play({ freq: 659.25, type: "sine", durationMs: 120, gain: 0.06 }), 80);
      setTimeout(() => play({ freq: 783.99, type: "sine", durationMs: 160, gain: 0.065 }), 160);
    },
  };
}

function drawRandomFaceToCanvas(canvas, seed) {
  const ctx = canvas.getContext("2d");
  const rand = mulberry32(seed);
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const bgA = `hsl(${Math.floor(rand() * 360)}, 38%, 16%)`;
  const bgB = `hsl(${Math.floor(rand() * 360)}, 42%, 10%)`;
  const grd = ctx.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, bgA);
  grd.addColorStop(1, bgB);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const faceW = w * (0.62 + rand() * 0.06);
  const faceH = h * (0.70 + rand() * 0.05);
  const faceY = cy + h * 0.02;

  const skinHue = 20 + rand() * 18;
  const skinSat = 45 + rand() * 20;
  const skinLit = 55 + rand() * 16;
  const skin = `hsl(${skinHue}, ${skinSat}%, ${skinLit}%)`;
  const skin2 = `hsl(${skinHue}, ${skinSat}%, ${skinLit - 10}%)`;

  ctx.save();
  ctx.translate(cx, faceY);
  ctx.scale(1, 1);

  ctx.beginPath();
  ctx.ellipse(0, 0, faceW / 2, faceH / 2, 0, 0, Math.PI * 2);
  const faceG = ctx.createRadialGradient(-faceW * 0.1, -faceH * 0.1, 20, 0, 0, faceW * 0.6);
  faceG.addColorStop(0, skin);
  faceG.addColorStop(1, skin2);
  ctx.fillStyle = faceG;
  ctx.fill();

  const hairHue = Math.floor(rand() * 40 + 10);
  const hair = `hsl(${hairHue}, ${25 + rand() * 35}%, ${12 + rand() * 18}%)`;
  ctx.beginPath();
  ctx.ellipse(0, -faceH * 0.22, faceW * 0.52, faceH * 0.32, 0, Math.PI, Math.PI * 2);
  ctx.fillStyle = hair;
  ctx.fill();

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.ellipse(-faceW * 0.22, faceH * 0.05, faceW * 0.2, faceH * 0.18, -0.6, 0, Math.PI * 2);
  ctx.ellipse(faceW * 0.22, faceH * 0.05, faceW * 0.2, faceH * 0.18, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const eyeY = -faceH * 0.04;
  const eyeX = faceW * 0.18;
  const eyeW = faceW * 0.12;
  const eyeH = faceH * 0.08;

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.ellipse(-eyeX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
  ctx.ellipse(eyeX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
  ctx.fill();

  const iris = `hsl(${Math.floor(rand() * 360)}, 60%, 38%)`;
  const pupilR = Math.max(3, Math.floor(w * 0.008));
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(-eyeX, eyeY, eyeH * 0.62, 0, Math.PI * 2);
  ctx.arc(eyeX, eyeY, eyeH * 0.62, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.beginPath();
  ctx.arc(-eyeX, eyeY, pupilR, 0, Math.PI * 2);
  ctx.arc(eyeX, eyeY, pupilR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = Math.max(2, Math.floor(w * 0.006));
  ctx.beginPath();
  ctx.arc(-eyeX, eyeY - eyeH * 0.3, eyeW, Math.PI * 1.05, Math.PI * 1.95);
  ctx.arc(eyeX, eyeY - eyeH * 0.3, eyeW, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.moveTo(0, eyeY + eyeH * 0.35);
  ctx.quadraticCurveTo(faceW * 0.04, faceH * 0.12, 0, faceH * 0.2);
  ctx.quadraticCurveTo(-faceW * 0.04, faceH * 0.12, 0, eyeY + eyeH * 0.35);
  ctx.fill();

  const mouthY = faceH * 0.18;
  const smile = -0.3 + rand() * 0.7;
  ctx.strokeStyle = `hsla(${skinHue + 220}, 35%, 32%, 0.75)`;
  ctx.lineWidth = Math.max(3, Math.floor(w * 0.008));
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-faceW * 0.14, mouthY);
  ctx.quadraticCurveTo(0, mouthY + faceH * 0.06 * smile, faceW * 0.14, mouthY);
  ctx.stroke();

  ctx.globalAlpha = 0.26;
  ctx.fillStyle = `hsl(${skinHue + 10}, ${skinSat + 10}%, ${skinLit + 10}%)`;
  ctx.beginPath();
  ctx.arc(-faceW * 0.22, faceH * 0.1, faceW * 0.07, 0, Math.PI * 2);
  ctx.arc(faceW * 0.22, faceH * 0.1, faceW * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

async function loadImageFromSrc(src) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  return img;
}

function createSquareImageDataUrl(img, size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.min(iw, ih);
  const sx = Math.floor((iw - s) / 2);
  const sy = Math.floor((ih - s) / 2);
  ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function waitForVideoReady(videoEl, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!videoEl) reject(new Error("videoEl missing"));
    const ready = () => (videoEl.videoWidth || 0) > 0 && (videoEl.videoHeight || 0) > 0;
    if (ready()) return resolve();

    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      cleanup();
      ok ? resolve() : reject(new Error("Video not ready"));
    };

    const onReady = () => {
      if (ready()) finish(true);
    };

    const cleanup = () => {
      videoEl.removeEventListener("loadedmetadata", onReady);
      videoEl.removeEventListener("canplay", onReady);
      videoEl.removeEventListener("playing", onReady);
    };

    videoEl.addEventListener("loadedmetadata", onReady, { once: true });
    videoEl.addEventListener("canplay", onReady, { once: true });
    videoEl.addEventListener("playing", onReady, { once: true });

    window.setTimeout(() => finish(ready()), timeoutMs);
  });
}

function captureSelfieDataUrl(videoEl, { size = 1024, mirror = true } = {}) {
  const vw = videoEl.videoWidth || 0;
  const vh = videoEl.videoHeight || 0;
  if (!vw || !vh) throw new Error("Video frame not available");

  const s = Math.min(vw, vh);
  const sx = Math.floor((vw - s) / 2);
  const sy = Math.floor((vh - s) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.save();
  if (mirror) {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(videoEl, sx, sy, s, s, 0, 0, size, size);
  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.92);
}

function computeScore({ sizeN, timeSec, moves }) {
  const base = sizeN * sizeN * 11000;
  const denom = 1 + timeSec + moves * 1.8;
  return Math.max(0, Math.round(base / denom));
}

function createConfetti(canvas) {
  if (!canvas?.getContext) {
    return {
      start: () => {},
      resize: () => {},
    };
  }
  const ctx = canvas.getContext("2d");
  const particles = [];
  let running = false;
  let raf = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnBurst(count = 180) {
    resize();
    const rect = canvas.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const x = rect.width * (0.2 + Math.random() * 0.6);
      const y = rect.height * (0.15 + Math.random() * 0.15);
      const a = Math.random() * Math.PI * 2;
      const v = 2.2 + Math.random() * 4.5;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v + 0.8,
        rot: Math.random() * Math.PI,
        vr: (-0.18 + Math.random() * 0.36) * Math.PI,
        size: 5 + Math.random() * 8,
        color: `hsl(${Math.floor(Math.random() * 360)}, 92%, 62%)`,
        life: 0,
        ttl: 180 + Math.random() * 80,
      });
    }
  }

  function tick() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += 1;
      p.vy += 0.05;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      const t = p.life / p.ttl;
      const alpha = 1 - t;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
      if (p.life >= p.ttl || p.y > rect.height + 40) particles.splice(i, 1);
    }
    if (particles.length) {
      raf = requestAnimationFrame(tick);
    } else {
      running = false;
    }
  }

  function start() {
    if (running) return;
    running = true;
    spawnBurst(220);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  return { start, resize };
}

let dom = null;

function getDomRefs() {
  return {
    board: $("board"),
    difficultySelect: $("difficultySelect"),
    newGameBtn: $("newGameBtn"),
    shuffleBtn: $("shuffleBtn"),
    hintBtn: $("hintBtn"),
    toggleThemeBtn: $("toggleThemeBtn"),
    toggleSoundBtn: $("toggleSoundBtn"),
    faceSelect: $("faceSelect"),
    selfieBtn: $("selfieBtn"),
    randomFaceBtn: $("randomFaceBtn"),
    uploadBtn: $("uploadBtn"),
    fileInput: $("fileInput"),
    previewCanvas: $("previewCanvas"),
    progressFill: $("progressFill"),
    progressLabel: $("progressLabel"),
    timeLabel: $("timeLabel"),
    movesLabel: $("movesLabel"),
    scoreLabel: $("scoreLabel"),
    imageLabel: $("imageLabel"),
    bestLabel: $("bestLabel"),
    inputModeLabel: $("inputModeLabel"),
    leaderboard: $("leaderboard"),
    resetScoresBtn: $("resetScoresBtn"),
    boardHintOverlay: $("boardHintOverlay"),
    confettiCanvas: $("confettiCanvas"),
    winModal: $("winModal"),
    closeWinBtn: $("closeWinBtn"),
    playAgainBtn: $("playAgainBtn"),
    newFaceBtn: $("newFaceBtn"),
    winTime: $("winTime"),
    winMoves: $("winMoves"),
    winScore: $("winScore"),
    winDifficulty: $("winDifficulty"),
    toggleHandBtn: $("toggleHandBtn"),
    toggleOverlayBtn: $("toggleOverlayBtn"),
    camVideo: $("camVideo"),
    camOverlay: $("camOverlay"),
    handStatus: $("handStatus"),
    cursor: $("virtualCursor"),
    handStage: document.querySelector(".handStage"),
  };
}

const STORAGE_KEY = "facePuzzle.highScores.v1";

const sound = createTonePlayer();
let confetti = null;

const state = {
  n: 4,
  imageDataUrl: "",
  imageLabel: "Random",
  slots: [],
  pieces: [],
  dragging: null,
  moves: 0,
  startAtMs: 0,
  timerId: 0,
  solved: false,
  theme: "dark",
};

function getBoardRect() {
  return dom?.board?.getBoundingClientRect?.() ?? { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
}

function getSlotIndexFromEl(slotEl) {
  return Number(slotEl?.dataset?.slotIndex ?? -1);
}

function getCorrectIndexFromPiece(pieceEl) {
  return Number(pieceEl?.dataset?.correctIndex ?? -1);
}

function updateStats() {
  dom?.movesLabel && (dom.movesLabel.textContent = String(state.moves));
  const timeSec = state.startAtMs ? (nowMs() - state.startAtMs) / 1000 : 0;
  dom?.timeLabel && (dom.timeLabel.textContent = formatTime(timeSec));
  dom?.scoreLabel &&
    (dom.scoreLabel.textContent = String(computeScore({ sizeN: state.n, timeSec, moves: state.moves })));
}

function countCorrectPieces() {
  let correct = 0;
  for (const slot of state.slots) {
    const slotIndex = getSlotIndexFromEl(slot);
    const piece = slot.querySelector(".piece");
    if (!piece) continue;
    if (getCorrectIndexFromPiece(piece) === slotIndex) correct++;
  }
  return correct;
}

function updateProgress() {
  const total = state.n * state.n;
  const correct = countCorrectPieces();
  const pct = Math.round((correct / total) * 100);
  dom?.progressLabel && (dom.progressLabel.textContent = String(pct));
  dom?.progressFill && (dom.progressFill.style.width = `${pct}%`);

  for (const slot of state.slots) {
    const slotIndex = getSlotIndexFromEl(slot);
    const piece = slot.querySelector(".piece");
    if (!piece) continue;
    piece.classList.toggle("correct", getCorrectIndexFromPiece(piece) === slotIndex);
  }
}

function setSolved(value) {
  state.solved = Boolean(value);
  if (state.solved) {
    clearInterval(state.timerId);
    state.timerId = 0;
  }
}

function isSolved() {
  const total = state.n * state.n;
  return countCorrectPieces() === total;
}

function showWinModal(summary) {
  dom?.winTime && (dom.winTime.textContent = summary.timeLabel);
  dom?.winMoves && (dom.winMoves.textContent = String(summary.moves));
  dom?.winScore && (dom.winScore.textContent = String(summary.score));
  dom?.winDifficulty && (dom.winDifficulty.textContent = `${state.n}×${state.n}`);
  dom?.winModal?.classList?.remove?.("hidden");
}

function hideWinModal() {
  dom?.winModal?.classList?.add?.("hidden");
}

function getHighScores() {
  return safeLocalStorageGet(STORAGE_KEY, { byDifficulty: {} });
}

function setHighScores(data) {
  safeLocalStorageSet(STORAGE_KEY, data);
}

function addHighScore({ difficulty, score, timeSec, moves }) {
  const data = getHighScores();
  const key = String(difficulty);
  const list = Array.isArray(data.byDifficulty[key]) ? data.byDifficulty[key] : [];
  list.push({
    score,
    timeSec: Math.round(timeSec),
    moves,
    at: new Date().toISOString(),
  });
  list.sort((a, b) => b.score - a.score);
  data.byDifficulty[key] = list.slice(0, 10);
  setHighScores(data);
}

function renderLeaderboard() {
  if (!dom?.leaderboard) return;
  const data = getHighScores();
  const key = String(state.n);
  const list = Array.isArray(data.byDifficulty[key]) ? data.byDifficulty[key] : [];
  dom.leaderboard.innerHTML = "";
  if (!list.length) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>—</strong><span>No scores yet</span>`;
    dom.leaderboard.appendChild(li);
    if (dom.bestLabel) dom.bestLabel.textContent = "—";
    return;
  }
  if (dom.bestLabel) {
    dom.bestLabel.textContent = `${list[0].score} (${formatTime(list[0].timeSec)} / ${list[0].moves} moves)`;
  }
  for (const [i, item] of list.entries()) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>#${i + 1} ${item.score}</strong><span>${formatTime(item.timeSec)} · ${item.moves} moves</span>`;
    dom.leaderboard.appendChild(li);
  }
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  dom.toggleThemeBtn?.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  localStorage.setItem("facePuzzle.theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("facePuzzle.theme");
  if (saved === "light" || saved === "dark") {
    applyTheme(saved);
    return;
  }
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
  applyTheme(prefersLight ? "light" : "dark");
}

function setReferencePreview(dataUrl) {
  if (!dom?.previewCanvas) return;
  const ctx = dom.previewCanvas.getContext?.("2d");
  if (!ctx) return;
  const img = new Image();
  img.src = dataUrl;
  img.onload = () => {
    ctx.clearRect(0, 0, dom.previewCanvas.width, dom.previewCanvas.height);
    ctx.drawImage(img, 0, 0, dom.previewCanvas.width, dom.previewCanvas.height);
  };
}

async function setImageFromDataUrl(dataUrl, label) {
  state.imageDataUrl = dataUrl;
  state.imageLabel = label;
  dom?.imageLabel && (dom.imageLabel.textContent = label);
  setReferencePreview(dataUrl);
  dom?.boardHintOverlay && (dom.boardHintOverlay.style.backgroundImage = `url("${dataUrl}")`);
}

const GALLERY_SEEDS = [0x1f3a7b2, 0x2a91e53, 0x3bb17a1, 0x4c0dd2f, 0x5d7f33b, 0x6e5a911];

async function generateGalleryFace(index1Based) {
  const idx = clamp(Number(index1Based) - 1, 0, GALLERY_SEEDS.length - 1);
  const seed = GALLERY_SEEDS[idx];
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  drawRandomFaceToCanvas(c, seed);
  const dataUrl = c.toDataURL("image/jpeg", 0.92);
  await setImageFromDataUrl(dataUrl, `Gallery ${idx + 1}`);
}

async function generateRandomFace() {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  drawRandomFaceToCanvas(c, seed);
  const dataUrl = c.toDataURL("image/jpeg", 0.92);
  await setImageFromDataUrl(dataUrl, `Random #${seed.toString(16).slice(0, 5)}`);
}

function createBoardGrid(n) {
  if (!dom?.board) return;
  dom.board.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
  dom.board.style.gridTemplateRows = `repeat(${n}, minmax(0, 1fr))`;
  dom.board.innerHTML = "";

  const slots = [];
  const total = n * n;
  for (let i = 0; i < total; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.slotIndex = String(i);
    slots.push(slot);
    dom.board.appendChild(slot);
  }
  state.slots = slots;
}

function createPieces(n, imageDataUrl) {
  const total = n * n;
  const pieces = [];
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / n);
    const c = i % n;
    const piece = document.createElement("div");
    piece.className = "piece";
    piece.dataset.correctIndex = String(i);
    piece.style.backgroundImage = `url("${imageDataUrl}")`;
    piece.style.backgroundSize = `${n * 100}% ${n * 100}%`;
    piece.style.backgroundPosition = `${(c / (n - 1)) * 100}% ${(r / (n - 1)) * 100}%`;
    piece.setAttribute("role", "button");
    piece.setAttribute("aria-label", `Piece ${i + 1}`);
    pieces.push(piece);
  }
  state.pieces = pieces;
}

function dealShuffledPieces() {
  const indices = [...state.pieces.keys()];
  shuffleInPlace(indices);
  for (let slotIndex = 0; slotIndex < state.slots.length; slotIndex++) {
    const slot = state.slots[slotIndex];
    slot.innerHTML = "";
    slot.appendChild(state.pieces[indices[slotIndex]]);
  }
}

function resetGameState({ preserveImage = true } = {}) {
  state.moves = 0;
  state.solved = false;
  state.startAtMs = nowMs();
  clearInterval(state.timerId);
  state.timerId = window.setInterval(updateStats, 250);
  updateStats();
  updateProgress();
  if (!preserveImage) state.imageDataUrl = "";
}

function buildNewPuzzle() {
  state.n = Number(dom?.difficultySelect?.value || state.n || 4);
  createBoardGrid(state.n);
  createPieces(state.n, state.imageDataUrl);
  dealShuffledPieces();
  resetGameState({ preserveImage: true });
  renderLeaderboard();
}

function highlightDropTarget(slotEl) {
  for (const s of state.slots) s.classList.remove("activeDrop");
  if (slotEl) slotEl.classList.add("activeDrop");
}

function getSlotAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  const slot = el?.closest?.(".slot");
  if (slot) return slot;

  const rect = getBoardRect();
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
  const centers = state.slots.map((s) => {
    const r = s.getBoundingClientRect();
    return { el: s, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
  });
  let best = null;
  let bestD = Infinity;
  for (const c of centers) {
    const d = Math.hypot(x - c.cx, y - c.cy);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (!best) return null;
  const snap = Math.min(best.w, best.h) * 0.75;
  return bestD <= snap ? best.el : null;
}

function getPieceAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return el?.closest?.(".piece") ?? null;
}

function normalizeDraggingPieceSize(pieceEl, fromSlotEl) {
  const rect = fromSlotEl.getBoundingClientRect();
  pieceEl.style.width = `${rect.width}px`;
  pieceEl.style.height = `${rect.height}px`;
}

function dragStart(pieceEl, x, y, { input = "mouse" } = {}) {
  if (state.solved) return;
  if (!pieceEl) return;
  if (state.dragging) return;

  const fromSlot = pieceEl.closest(".slot");
  if (!fromSlot) return;

  const rect = pieceEl.getBoundingClientRect();
  const offsetX = x - rect.left;
  const offsetY = y - rect.top;

  normalizeDraggingPieceSize(pieceEl, fromSlot);
  fromSlot.innerHTML = "";

  pieceEl.classList.add("dragging");
  pieceEl.dataset.dragFromSlot = fromSlot.dataset.slotIndex;
  pieceEl.style.setProperty("--dx", `${x - offsetX}px`);
  pieceEl.style.setProperty("--dy", `${y - offsetY}px`);

  document.body.appendChild(pieceEl);

  state.dragging = { pieceEl, fromSlot, offsetX, offsetY, input };
  highlightDropTarget(getSlotAtPoint(x, y));
  sound.pick();
}

function dragMove(x, y, { input = "mouse" } = {}) {
  if (!state.dragging) return;
  if (state.dragging.input !== input) return;
  const { pieceEl, offsetX, offsetY } = state.dragging;
  pieceEl.style.setProperty("--dx", `${x - offsetX}px`);
  pieceEl.style.setProperty("--dy", `${y - offsetY}px`);
  highlightDropTarget(getSlotAtPoint(x, y));
}

function dragEnd(x, y, { input = "mouse", cancelled = false } = {}) {
  if (!state.dragging) return;
  if (state.dragging.input !== input) return;

  const { pieceEl, fromSlot } = state.dragging;
  state.dragging = null;
  highlightDropTarget(null);

  pieceEl.classList.remove("dragging");
  pieceEl.style.width = "";
  pieceEl.style.height = "";

  const targetSlot = cancelled ? null : getSlotAtPoint(x, y);
  const finalSlot = targetSlot || fromSlot;

  const existing = finalSlot.querySelector(".piece");
  if (existing && existing !== pieceEl) {
    fromSlot.appendChild(existing);
  }
  finalSlot.appendChild(pieceEl);

  const moved = finalSlot !== fromSlot;
  if (moved) state.moves += 1;
  updateStats();
  updateProgress();
  sound.drop();

  if (!state.solved && isSolved()) {
    setSolved(true);
    const timeSec = state.startAtMs ? (nowMs() - state.startAtMs) / 1000 : 0;
    const score = computeScore({ sizeN: state.n, timeSec, moves: state.moves });
    addHighScore({ difficulty: state.n, score, timeSec, moves: state.moves });
    _recordLocalScore('face-puzzle', score);
    renderLeaderboard();
    confetti?.start?.();
    sound.win();

    const wrap = dom.board.closest(".boardWrap");
    wrap?.animate?.(
      [
        { transform: "scale(1)", filter: "brightness(1)" },
        { transform: "scale(1.02)", filter: "brightness(1.08)" },
        { transform: "scale(1)", filter: "brightness(1)" },
      ],
      { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" },
    );

    showWinModal({
      timeLabel: formatTime(timeSec),
      moves: state.moves,
      score,
    });
  }
}

function bindPointerControls() {
  if (!dom?.board) return;
  dom.board.addEventListener("pointerdown", (e) => {
    const piece = e.target.closest?.(".piece");
    if (!piece) return;
    if (state.dragging) return;
    piece.setPointerCapture?.(e.pointerId);
    dragStart(piece, e.clientX, e.clientY, { input: "mouse" });
  });

  window.addEventListener("pointermove", (e) => {
    if (!state.dragging) return;
    dragMove(e.clientX, e.clientY, { input: "mouse" });
  });

  window.addEventListener("pointerup", (e) => {
    if (!state.dragging) return;
    dragEnd(e.clientX, e.clientY, { input: "mouse" });
  });

  window.addEventListener("pointercancel", (e) => {
    if (!state.dragging) return;
    dragEnd(e.clientX, e.clientY, { input: "mouse", cancelled: true });
  });
}

function showHint() {
  if (!dom?.boardHintOverlay) return;
  dom.boardHintOverlay.classList.add("show");
  window.setTimeout(() => dom.boardHintOverlay?.classList?.remove?.("show"), 1200);
}

async function handleUploadFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImageFromSrc(url);
    const square = createSquareImageDataUrl(img, 1024);
    await setImageFromDataUrl(square, `Upload: ${file.name}`);
    buildNewPuzzle();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function bindUI() {
  dom?.difficultySelect?.addEventListener("change", () => {
    buildNewPuzzle();
  });

  dom.faceSelect?.addEventListener("change", async () => {
    const value = String(dom.faceSelect.value || "");
    if (value.startsWith("gallery:")) {
      const idx = Number(value.split(":")[1] || 1);
      await generateGalleryFace(idx);
      buildNewPuzzle();
    }
  });

  dom?.newGameBtn?.addEventListener("click", () => {
    buildNewPuzzle();
  });

  dom?.shuffleBtn?.addEventListener("click", () => {
    dealShuffledPieces();
    resetGameState({ preserveImage: true });
  });

  dom?.hintBtn?.addEventListener("click", () => showHint());

  dom?.toggleThemeBtn?.addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  });

  dom?.toggleSoundBtn?.addEventListener("click", () => {
    sound.setEnabled(!sound.getEnabled());
    dom.toggleSoundBtn?.setAttribute?.("aria-pressed", sound.getEnabled() ? "true" : "false");
    if (dom.toggleSoundBtn) dom.toggleSoundBtn.textContent = sound.getEnabled() ? "Sound" : "Muted";
  });

  dom?.randomFaceBtn?.addEventListener("click", async () => {
    await generateRandomFace();
    buildNewPuzzle();
  });

  dom?.uploadBtn?.addEventListener("click", () => dom?.fileInput?.click?.());
  dom?.fileInput?.addEventListener("change", async () => {
    const file = dom?.fileInput?.files?.[0];
    if (dom?.fileInput) dom.fileInput.value = "";
    await handleUploadFile(file);
  });

  dom?.closeWinBtn?.addEventListener("click", () => hideWinModal());
  dom?.playAgainBtn?.addEventListener("click", () => {
    hideWinModal();
    buildNewPuzzle();
  });
  dom?.newFaceBtn?.addEventListener("click", async () => {
    hideWinModal();
    await generateRandomFace();
    buildNewPuzzle();
  });

  dom?.resetScoresBtn?.addEventListener("click", () => {
    setHighScores({ byDifficulty: {} });
    renderLeaderboard();
  });

  window.addEventListener("resize", () => confetti?.resize?.());
}

function initAccessibility() {
  if (!dom?.board) return;
  dom.board.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const piece = e.target.closest?.(".piece");
    if (!piece) return;
    e.preventDefault();
  });
}

async function main() {
  dom = getDomRefs();
  confetti = createConfetti(dom.confettiCanvas);
  state.n = Number(dom.difficultySelect?.value || 4);

  initTheme();
  dom.toggleSoundBtn?.setAttribute("aria-pressed", "true");

  let handTracking = null;
  let gesture = null;
  let handEnabled = false;
  let overlayEnabled = true;

  if (dom.camVideo && dom.camOverlay && dom.handStatus && dom.cursor && dom.board) {
    handTracking = createHandTracking({
      videoEl: dom.camVideo,
      overlayCanvasEl: dom.camOverlay,
      statusEl: dom.handStatus,
      mirror: true,
    });

    gesture = createGestureController({
      handTracking,
      cursorEl: dom.cursor,
      stageEl: dom.board,
      mirror: true,
      getPieceAtPoint,
      dragStart,
      dragMove,
      dragEnd,
      onHandPresenceChange: (present) => {
        if (dom.inputModeLabel) {
          dom.inputModeLabel.textContent = present ? "Mouse + Hand (Hand detected)" : "Mouse + Hand";
        }
      },
    });

    handEnabled = true;

    dom.toggleHandBtn?.addEventListener("click", () => {
      handEnabled = !handEnabled;
      handTracking.setEnabled(handEnabled);
      gesture.setEnabled(handEnabled);
      dom.toggleHandBtn.classList.toggle("primary", handEnabled);
      dom.toggleHandBtn.setAttribute("aria-pressed", handEnabled ? "true" : "false");
      dom.toggleHandBtn.textContent = handEnabled ? "Enabled" : "Disabled";
      if (!handEnabled && dom.handStatus) dom.handStatus.textContent = "Hand: disabled";
    });

    dom.toggleOverlayBtn?.addEventListener("click", () => {
      overlayEnabled = !overlayEnabled;
      handTracking.setOverlayVisible(overlayEnabled);
      dom.toggleOverlayBtn.setAttribute("aria-pressed", overlayEnabled ? "true" : "false");
      dom.toggleOverlayBtn.textContent = overlayEnabled ? "Overlay" : "No Overlay";
    });
  } else if (dom.inputModeLabel) {
    dom.inputModeLabel.textContent = "Mouse";
  }

  const takeSelfie = async () => {
    if (!handTracking || !gesture) return;
    try {
      if (!handEnabled) {
        handEnabled = true;
        handTracking.setEnabled(true);
        gesture.setEnabled(true);
        dom.toggleHandBtn.classList.toggle("primary", true);
        dom.toggleHandBtn.setAttribute("aria-pressed", "true");
        dom.toggleHandBtn.textContent = "Enabled";
      }

      await handTracking.start();
      await waitForVideoReady(dom.camVideo, 6000);
      const selfie = captureSelfieDataUrl(dom.camVideo, { size: 1024, mirror: true });
      await setImageFromDataUrl(selfie, "Selfie");
      if (dom.faceSelect) dom.faceSelect.value = "gallery:1";
      buildNewPuzzle();
    } catch {
      dom.handStatus.textContent = "Hand: camera blocked";
      gesture.setEnabled(false);
    }
  };

  dom.selfieBtn?.addEventListener("click", takeSelfie);

  if (handTracking && gesture) {
    try {
      await handTracking.start();
    } catch (err) {
      if (dom.handStatus) dom.handStatus.textContent = "Hand: camera blocked";
      gesture.setEnabled(false);
    }
  }

  await generateGalleryFace(1);
  buildNewPuzzle();

  bindUI();
  bindPointerControls();
  initAccessibility();

  renderLeaderboard();
  updateProgress();
}

window.addEventListener("DOMContentLoaded", () => {
  main();
});
