export function createHandTracking({
  videoEl,
  overlayCanvasEl,
  statusEl,
  mirror = true,
  maxNumHands = 1,
  modelComplexity = 1,
  smoothOverlay = true,
} = {}) {
  // MediaPipe Hands wrapper:
  // - Starts webcam capture (Camera Utils)
  // - Runs Hands model per frame
  // - Exposes results via setOnResults(cb)
  // - Draws an optional landmark overlay for debugging
  if (!videoEl || !overlayCanvasEl) {
    throw new Error("createHandTracking requires { videoEl, overlayCanvasEl }");
  }

  let enabled = true;
  let running = false;
  let hasHand = false;
  let lastResults = null;
  let onResultsCb = null;
  let camera = null;
  let hands = null;

  const overlayCtx = overlayCanvasEl.getContext("2d", { alpha: true });

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function isSupported() {
    return typeof window !== "undefined" && typeof window.Hands !== "undefined";
  }

  function fitOverlayToVideoFrame() {
    const w = videoEl.videoWidth || 0;
    const h = videoEl.videoHeight || 0;
    if (!w || !h) return;
    if (overlayCanvasEl.width !== w) overlayCanvasEl.width = w;
    if (overlayCanvasEl.height !== h) overlayCanvasEl.height = h;
  }

  function clearOverlay() {
    overlayCtx.clearRect(0, 0, overlayCanvasEl.width, overlayCanvasEl.height);
  }

  function drawOverlay(results) {
    if (!overlayCtx) return;
    fitOverlayToVideoFrame();
    clearOverlay();

    if (!results?.multiHandLandmarks?.length) return;

    for (const landmarks of results.multiHandLandmarks) {
      if (window.drawConnectors) {
        window.drawConnectors(overlayCtx, landmarks, window.HAND_CONNECTIONS, { color: "#28d7a5", lineWidth: 2 });
      }
      if (window.drawLandmarks) {
        window.drawLandmarks(overlayCtx, landmarks, { color: "#7c5cff", lineWidth: 1, radius: 2 });
      }
    }
  }

  function setOnResults(cb) {
    onResultsCb = cb;
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) {
      setStatus("Hand: disabled");
      hasHand = false;
      clearOverlay();
    } else if (running) {
      setStatus("Hand: enabled");
    }
  }

  function setOverlayVisible(visible) {
    overlayCanvasEl.style.display = visible ? "block" : "none";
  }

  function getState() {
    return { enabled, running, hasHand, lastResults };
  }

  async function start() {
    if (!isSupported()) {
      setStatus("Hand: MediaPipe not loaded");
      return;
    }
    if (running) return;

    setStatus("Hand: starting camera…");
    running = true;

    hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands,
      modelComplexity,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    hands.onResults((results) => {
      lastResults = results;
      hasHand = Boolean(results?.multiHandLandmarks?.length);
      if (enabled && smoothOverlay) drawOverlay(results);
      if (enabled && onResultsCb) onResultsCb(results);
      if (!enabled) return;
      setStatus(hasHand ? "Hand: detected" : "Hand: not detected");
    });

    camera = new window.Camera(videoEl, {
      onFrame: async () => {
        if (!running) return;
        if (!enabled) return;
        await hands.send({ image: videoEl });
      },
      width: 1280,
      height: 720,
    });

    try {
      await camera.start();
      setStatus("Hand: ready");
    } catch (err) {
      running = false;
      setStatus("Hand: camera blocked");
      clearOverlay();
      throw err;
    }
  }

  async function stop() {
    enabled = false;
    running = false;
    hasHand = false;
    lastResults = null;
    clearOverlay();
    setStatus("Hand: stopped");
    try {
      if (camera) camera.stop();
    } catch {}
    camera = null;
    try {
      if (hands) hands.close();
    } catch {}
    hands = null;
  }

  return {
    start,
    stop,
    setEnabled,
    setOverlayVisible,
    setOnResults,
    getState,
    get mirror() {
      return mirror;
    },
  };
}
