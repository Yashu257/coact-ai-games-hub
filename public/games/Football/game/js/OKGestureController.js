/**
 * OKGestureController.js
 * Detects the OK gesture (👌) from MediaPipe Hands landmarks.
 *
 * OK gesture definition:
 *   • Thumb tip  (lm[4])  and index tip (lm[8]) are close together
 *     (distance < OK_THRESHOLD in normalised 0..1 space)
 *   • Middle (lm[12]), ring (lm[16]), pinky (lm[20]) tips are
 *     above their respective PIP joints → extended
 *
 * Released definition:
 *   • Thumb/index distance > RELEASE_THRESHOLD
 *
 * Output:
 *   { isOK: bool, cursorNorm: {x, y}, confidence: 0..1 }
 *   cursorNorm = midpoint of thumb-tip and index-tip, normalised 0..1
 */

var OKGestureController = (function () {

    // ── Tuning ─────────────────────────────────────────────────────────────
    var OK_THRESHOLD      = 0.09;   // normalised distance: thumb-tip ↔ index-tip
    var RELEASE_THRESHOLD = 0.14;   // must exceed this to count as released
    var MIN_EXT_FINGERS   = 2;      // how many of middle/ring/pinky must be extended

    // Debounce: consecutive frames required before state changes
    var OK_HOLD_FRAMES      = 2;
    var RELEASE_HOLD_FRAMES = 2;

    // ── Internal state ─────────────────────────────────────────────────────
    var _okFrames      = 0;
    var _releaseFrames = 0;
    var _stateOK       = false;

    // Smoothing: ring buffer of cursor positions
    var _SMOOTH_N  = 5;
    var _smoothBuf = [];

    // ── Helpers ────────────────────────────────────────────────────────────
    function _dist(a, b) {
        var dx = a.x - b.x, dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function _isExtended(lm, tipIdx, pipIdx) {
        return lm[tipIdx].y < lm[pipIdx].y;   // tip above PIP in image-y
    }

    function _smoothCursor(raw) {
        _smoothBuf.push({ x: raw.x, y: raw.y });
        if (_smoothBuf.length > _SMOOTH_N) { _smoothBuf.shift(); }
        var sx = 0, sy = 0;
        for (var i = 0; i < _smoothBuf.length; i++) {
            sx += _smoothBuf[i].x;
            sy += _smoothBuf[i].y;
        }
        return { x: sx / _smoothBuf.length, y: sy / _smoothBuf.length };
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Process one frame's landmarks for a single hand.
     * @param {Array|null} lm  21 landmark objects {x,y,z} or null if no hand
     * @returns {{ isOK: boolean, cursorNorm: {x,y}|null, confidence: number }}
     */
    function process(lm) {
        if (!lm || lm.length < 21) {
            _okFrames = 0; _releaseFrames = 0;
            _smoothBuf = [];
            return { isOK: false, cursorNorm: null, confidence: 0 };
        }

        var thumbTip = lm[4];
        var indexTip = lm[8];
        var d        = _dist(thumbTip, indexTip);

        // Raw cursor = midpoint of the pinch
        var rawCursor = { x: (thumbTip.x + indexTip.x) * 0.5,
                          y: (thumbTip.y + indexTip.y) * 0.5 };
        var cursor    = _smoothCursor(rawCursor);

        // Extended fingers check
        var extCount = 0;
        if (_isExtended(lm, 12, 10)) { extCount++; }
        if (_isExtended(lm, 16, 14)) { extCount++; }
        if (_isExtended(lm, 20, 18)) { extCount++; }

        var pinching = d < OK_THRESHOLD && extCount >= MIN_EXT_FINGERS;
        var released = d > RELEASE_THRESHOLD;

        if (_stateOK) {
            // Currently in OK state – check for release
            if (released) {
                _releaseFrames++;
                _okFrames = 0;
                if (_releaseFrames >= RELEASE_HOLD_FRAMES) {
                    _stateOK       = false;
                    _releaseFrames = 0;
                    _smoothBuf     = [];
                }
            } else {
                _releaseFrames = 0;
            }
        } else {
            // Currently released – check for OK
            if (pinching) {
                _okFrames++;
                _releaseFrames = 0;
                if (_okFrames >= OK_HOLD_FRAMES) {
                    _stateOK  = true;
                    _okFrames = 0;
                }
            } else {
                _okFrames = 0;
            }
        }

        // Confidence = 1 when fully pinched, 0 when fully apart
        var confidence = Math.max(0, Math.min(1, 1 - (d / OK_THRESHOLD)));

        return {
            isOK:       _stateOK,
            cursorNorm: cursor,           // normalised 0..1 (camera space)
            confidence: confidence,
            pinchDist:  d                 // raw, for debug
        };
    }

    function reset() {
        _okFrames = 0; _releaseFrames = 0;
        _stateOK  = false; _smoothBuf = [];
    }

    return { process: process, reset: reset };
}());
