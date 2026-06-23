function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function ema(prev, next, alpha) {
  if (!prev) return { x: next.x, y: next.y };
  return { x: prev.x + (next.x - prev.x) * alpha, y: prev.y + (next.y - prev.y) * alpha };
}

export function createGestureController({
  handTracking,
  cursorEl,
  stageEl,
  onHandPresenceChange,
  onPinchChange,
  getPieceAtPoint,
  dragStart,
  dragMove,
  dragEnd,
  mirror = true,
} = {}) {
  // Converts MediaPipe landmarks into gameplay input:
  // - Index tip becomes a smoothed "virtual cursor"
  // - Pinch gesture (thumb tip + index tip) grabs/releases pieces
  // - Cancels dragging when the hand disappears
  if (!handTracking) throw new Error("createGestureController requires { handTracking }");
  if (!cursorEl || !stageEl) throw new Error("createGestureController requires { cursorEl, stageEl }");

  const cfg = {
    cursorAlpha: 0.22,
    maxJumpPx: 64,
    pinchStart: 0.035,
    pinchEnd: 0.055,
    pinchDebounceMs: 40,
    lostHandGraceMs: 220,
  };

  let enabled = true;
  let lastCursor = null;
  let lastRawCursor = null;
  let pinching = false;
  let lastPinchAt = 0;
  let draggingByHand = false;
  let lastSeenAt = 0;

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) {
      cursorEl.classList.remove("show");
      if (draggingByHand) {
        draggingByHand = false;
        dragEnd?.(lastCursor?.x ?? 0, lastCursor?.y ?? 0, { input: "hand", cancelled: true });
      }
    }
  }

  function setCursorVisible(visible) {
    cursorEl.classList.toggle("show", Boolean(visible));
  }

  function stageToViewportFromNormalized({ x, y }) {
    const rect = stageEl.getBoundingClientRect();
    const nx = mirror ? 1 - x : x;
    return {
      x: rect.left + clamp(nx, 0, 1) * rect.width,
      y: rect.top + clamp(y, 0, 1) * rect.height,
    };
  }

  function updateCursor(pos) {
    if (!pos) return;
    lastRawCursor = pos;
    const next = stageToViewportFromNormalized(pos);

    if (lastCursor) {
      const dx = next.x - lastCursor.x;
      const dy = next.y - lastCursor.y;
      const d = Math.hypot(dx, dy);
      if (d > cfg.maxJumpPx) {
        const k = cfg.maxJumpPx / d;
        lastCursor = { x: lastCursor.x + dx * k, y: lastCursor.y + dy * k };
      } else {
        lastCursor = ema(lastCursor, next, cfg.cursorAlpha);
      }
    } else {
      lastCursor = next;
    }

    cursorEl.style.left = `${lastCursor.x}px`;
    cursorEl.style.top = `${lastCursor.y}px`;
  }

  function detectPinch(landmarks) {
    const thumbTip = landmarks?.[4];
    const indexTip = landmarks?.[8];
    if (!thumbTip || !indexTip) return { pinching: false, dist: Infinity };
    const dist = distance2D(thumbTip, indexTip);
    const now = performance.now();
    if (now - lastPinchAt < cfg.pinchDebounceMs) return { pinching, dist };
    if (!pinching && dist < cfg.pinchStart) {
      pinching = true;
      lastPinchAt = now;
    } else if (pinching && dist > cfg.pinchEnd) {
      pinching = false;
      lastPinchAt = now;
    }
    return { pinching, dist };
  }

  function handleResults(results) {
    if (!enabled) return;
    const landmarks = results?.multiHandLandmarks?.[0];
    const presentNow = Boolean(landmarks?.length);
    const t = performance.now();
    if (presentNow) lastSeenAt = t;
    const present = presentNow || t - lastSeenAt < cfg.lostHandGraceMs;
    onHandPresenceChange?.(present);

    if (!present) {
      setCursorVisible(false);
      if (draggingByHand) {
        draggingByHand = false;
        dragEnd?.(lastCursor?.x ?? 0, lastCursor?.y ?? 0, { input: "hand", cancelled: true });
      }
      return;
    }

    setCursorVisible(true);

    if (presentNow) {
      const indexTip = landmarks[8];
      updateCursor({ x: indexTip.x, y: indexTip.y });
    }

    const pinchResult = presentNow ? detectPinch(landmarks) : { pinching, dist: Infinity };
    const isPinchingNow = pinchResult.pinching;
    onPinchChange?.(isPinchingNow);

    if (!lastCursor) return;

    if (isPinchingNow && !draggingByHand) {
      const piece = getPieceAtPoint?.(lastCursor.x, lastCursor.y);
      if (piece) {
        draggingByHand = true;
        dragStart?.(piece, lastCursor.x, lastCursor.y, { input: "hand" });
      }
    } else if (isPinchingNow && draggingByHand) {
      dragMove?.(lastCursor.x, lastCursor.y, { input: "hand" });
    } else if (!isPinchingNow && draggingByHand) {
      draggingByHand = false;
      dragEnd?.(lastCursor.x, lastCursor.y, { input: "hand" });
    }
  }

  handTracking.setOnResults(handleResults);

  return {
    setEnabled,
    getState: () => ({
      enabled,
      cursor: lastCursor,
      rawCursor: lastRawCursor,
      pinching,
      draggingByHand,
    }),
  };
}
