/**
 * handpose.worker.js — Web Worker, runs off main thread.
 *
 * GESTURES (one hand controls everything):
 *   👍  Thumb only up           → ACCELERATE
 *   👆  Thumb + Index extended  → STEER RIGHT
 *   🤟  Thumb+Index+Middle ext  → STEER LEFT
 *   ✊  Fist (all curled)       → BRAKE
 *   (no hand visible)           → release all
 */

importScripts(
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/handpose@0.0.7/dist/handpose.min.js'
);

var _model = null;
var _busy  = false;
var VW = 320, VH = 240;

// ─────────────────────────────────────────────────────────────────────────────
// Gesture detection using 3D distances — robust to hand orientation
// handpose landmarks: [x, y, z] in pixel space
// ─────────────────────────────────────────────────────────────────────────────

function _dist(a, b) {
    var dx = a[0]-b[0], dy = a[1]-b[1], dz = (a[2]||0)-(b[2]||0);
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

// A finger is "extended" when its tip is far from the wrist relative to hand size
// This works regardless of hand orientation (up, sideways, tilted)
function _isFingerExtended(lm, tipIdx, mcpIdx) {
    var wrist  = lm[0];
    var tip    = lm[tipIdx];
    var mcp    = lm[mcpIdx];
    // Hand size reference: distance from wrist to middle finger MCP
    var handSz = _dist(wrist, lm[9]) || 1;
    // Finger is extended if tip is far from wrist (more than 0.7x hand size from wrist)
    return _dist(wrist, tip) > handSz * 0.7;
}

function _isThumbExtended(lm) {
    // Thumb: tip=4, MCP=2, wrist=0
    // Thumb is special — compare tip distance to index MCP as reference
    var wrist    = lm[0];
    var thumbTip = lm[4];
    var indexMcp = lm[5];
    var handSz   = _dist(wrist, lm[9]) || 1;
    // Thumb extended = thumb tip far from index finger base
    return _dist(thumbTip, indexMcp) > handSz * 0.5;
}

function _getGesture(lm) {
    var thumb  = _isThumbExtended(lm);
    var index  = _isFingerExtended(lm, 8,  5);
    var middle = _isFingerExtended(lm, 12, 9);
    var ring   = _isFingerExtended(lm, 16, 13);
    var pinky  = _isFingerExtended(lm, 20, 17);

    // Debug — post finger states so we can see what's happening
    self.postMessage({ type: 'debug', thumb:thumb, index:index, middle:middle, ring:ring, pinky:pinky });

    // STEER LEFT: thumb + index + middle
    if (thumb && index && middle) return 'STEER_LEFT';

    // STEER RIGHT: thumb + index only
    if (thumb && index && !middle) return 'STEER_RIGHT';

    // ACCELERATE: thumb only
    if (thumb && !index && !middle) return 'ACCELERATE';

    // BRAKE: fist
    if (!thumb && !index && !middle && !ring && !pinky) return 'BRAKE';

    return 'NONE';
}

function _palmCenter(lm) {
    var pts = [0, 5, 9, 13, 17];
    var sx = 0, sy = 0;
    for (var i = 0; i < pts.length; i++) { sx += lm[pts[i]][0]; sy += lm[pts[i]][1]; }
    return { x: sx / (pts.length * VW), y: sy / (pts.length * VH) };
}

function _makeHandData(pred) {
    var lm      = pred.landmarks;
    var gesture = _getGesture(lm);
    return {
        palm:       _palmCenter(lm),
        gesture:    gesture,
        thumbUp:    gesture === 'ACCELERATE',
        fist:       gesture === 'BRAKE',
        steerLeft:  gesture === 'STEER_LEFT',
        steerRight: gesture === 'STEER_RIGHT'
    };
}

// ── detection ─────────────────────────────────────────────────────────────

function _detect(imageBitmap) {
    if (_busy || !_model) { imageBitmap.close(); return; }
    _busy = true;

    var oc  = new OffscreenCanvas(VW, VH);
    var ctx = oc.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0, VW, VH);
    imageBitmap.close();

    _model.estimateHands(oc)
        .then(function(preds) {
            _busy = false;
            var leftHand = null, rightHand = null;

            if (preds && preds.length > 0) {
                // Sort by palm x — lower x = user's right (mirrored feed)
                var sorted = preds.slice().sort(function(a, b) {
                    return _palmCenter(a.landmarks).x - _palmCenter(b.landmarks).x;
                });
                if (sorted.length >= 2) {
                    rightHand = _makeHandData(sorted[0]);
                    leftHand  = _makeHandData(sorted[1]);
                } else {
                    var hd = _makeHandData(sorted[0]);
                    // Single hand — assign by position
                    if (hd.palm.x < 0.5) rightHand = hd;
                    else                  leftHand  = hd;
                }
            }

            self.postMessage({ type: 'hands', left: leftHand, right: rightHand });
        })
        .catch(function(e) {
            _busy = false;
            self.postMessage({ type: 'error', msg: e.message });
        });
}

// ── messages ──────────────────────────────────────────────────────────────

self.onmessage = function(e) {
    var msg = e.data;
    if (msg.type === 'init') {
        self.postMessage({ type: 'status', msg: 'Loading TF.js handpose...' });
        handpose.load()
            .then(function(model) {
                _model = model;
                self.postMessage({ type: 'ready' });
            })
            .catch(function(err) {
                self.postMessage({ type: 'failed', msg: err.message });
            });
    }
    if (msg.type === 'frame' && msg.bitmap) {
        _detect(msg.bitmap);
    }
};
