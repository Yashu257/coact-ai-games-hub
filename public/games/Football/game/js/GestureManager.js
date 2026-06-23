/**
 * GestureManager.js  –  Swipe-to-shoot via EaselJS internal API injection
 *
 * HOW IT WORKS:
 *   EaselJS Stage exposes _handlePointerDown / _handlePointerMove /
 *   _handlePointerUp internally.  We call those directly with a fake
 *   native event so the stage updates its pointer coords and fires
 *   the pressmove / pressup events that CGame's handlers are listening to.
 *
 *   Gesture flow:
 *     FIST (hold 3 frames)  → _handlePointerDown  (= mousedown on ball)
 *     FIST + move hand      → _handlePointerMove  (= pressmove / drag)
 *     OPEN PALM (2 frames)  → _handlePointerUp    (= pressup / shoot)
 *
 *   Hand position (index-finger tip, landmark 8) is mapped from
 *   normalised camera space [0..1] to game canvas pixels, accounting
 *   for the CSS-scaled canvas size and page offset.
 */

var GestureManager = (function () {

    // ── Constants ──────────────────────────────────────────────────────────
    var STATE_IDLE = 0;
    var STATE_DOWN = 1;

    // ── State ──────────────────────────────────────────────────────────────
    var _running     = false;
    var _hands       = null;
    var _mpCamera    = null;
    var _swipeState  = STATE_IDLE;

    // Pointer position in EaselJS canvas space (logical px)
    var _ptr         = { x: 0, y: 0 };

    // Smoothing ring-buffer
    var _SMOOTH      = 5;
    var _ptrBuf      = [];

    // Hold-frame counters
    var _fistFrames  = 0;
    var _openFrames  = 0;
    var FIST_HOLD    = 3;
    var OPEN_HOLD    = 2;

    // Cooldown after release
    var _lastRelease = 0;
    var COOLDOWN_MS  = 700;

    // DOM elements
    var _videoEl     = null;
    var _previewCvs  = null;
    var _previewCtx  = null;
    var _cursorCvs   = null;
    var _cursorCtx   = null;
    var _statusDiv   = null;

    // ── Coordinate mapping ────────────────────────────────────────────────
    /**
     * Convert normalised landmark coords [0..1] to EaselJS stage coords.
     * EaselJS Stage stores the canvas element rect and divides client coords
     * by the CSS scale factor itself inside _updatePointerPosition.
     * So we must give it *page* pixel coords (pageX / pageY equivalent).
     */
    function _toPageCoords(nx, ny) {
        var canvasEl = document.getElementById('canvas');
        if (!canvasEl) { return { x: 0, y: 0 }; }

        var rect  = canvasEl.getBoundingClientRect();
        var scrollX = window.pageXOffset || 0;
        var scrollY = window.pageYOffset || 0;

        // Mirror x so moving right in camera = right on screen
        var fx = 1 - nx;

        return {
            x: rect.left + scrollX + fx * rect.width,
            y: rect.top  + scrollY + ny * rect.height
        };
    }

    /** Push raw point and return smoothed average. */
    function _smooth(x, y) {
        _ptrBuf.push({ x: x, y: y });
        if (_ptrBuf.length > _SMOOTH) { _ptrBuf.shift(); }
        var sx = 0, sy = 0;
        for (var i = 0; i < _ptrBuf.length; i++) {
            sx += _ptrBuf[i].x;
            sy += _ptrBuf[i].y;
        }
        return { x: sx / _ptrBuf.length, y: sy / _ptrBuf.length };
    }

    // ── EaselJS injection ─────────────────────────────────────────────────
    /**
     * Build a minimal fake native event that satisfies EaselJS's
     * _handlePointerDown / _handlePointerMove / _handlePointerUp.
     * EaselJS reads .pageX, .pageY and calls .preventDefault().
     */
    function _fakeNative(pageX, pageY) {
        return {
            pageX: pageX,
            pageY: pageY,
            preventDefault: function () {}
        };
    }

    function _injectDown(pageX, pageY) {
        if (!window.s_oStage) { return; }
        var ev = _fakeNative(pageX, pageY);
        // pointer id -1 is the primary mouse pointer in EaselJS
        s_oStage._handlePointerDown(-1, ev, pageX, pageY);
    }

    function _injectMove(pageX, pageY) {
        if (!window.s_oStage) { return; }
        var ev = _fakeNative(pageX, pageY);
        s_oStage._handlePointerMove(-1, ev, pageX, pageY);
    }

    function _injectUp(pageX, pageY) {
        if (!window.s_oStage) { return; }
        var ev = _fakeNative(pageX, pageY);
        s_oStage._handlePointerUp(-1, ev, false);
    }

    // ── Gesture classifiers ───────────────────────────────────────────────
    function _isFist(lm) {
        // All four finger tips below their MCP base joints
        var tips = [8, 12, 16, 20];
        var mcps = [5,  9, 13, 17];
        for (var i = 0; i < 4; i++) {
            if (lm[tips[i]].y < lm[mcps[i]].y) { return false; }
        }
        return true;
    }

    function _isOpen(lm) {
        // At least 3 finger tips above their PIP joints
        var pairs = [[8,6],[12,10],[16,14],[20,18]];
        var n = 0;
        for (var i = 0; i < 4; i++) {
            if (lm[pairs[i][0]].y < lm[pairs[i][1]].y) { n++; }
        }
        return n >= 3;
    }

    // ── Visual feedback ───────────────────────────────────────────────────
    function _drawCursor(cx, cy, isDown) {
        if (!_cursorCtx) { return; }
        var w = _cursorCvs.width;
        var h = _cursorCvs.height;
        _cursorCtx.clearRect(0, 0, w, h);

        // Convert logical EaselJS coords → canvas pixel coords
        // (the cursor overlay matches the game canvas size exactly)
        var canvasEl = document.getElementById('canvas');
        if (!canvasEl) { return; }
        var rect  = canvasEl.getBoundingClientRect();
        var scrollX = window.pageXOffset || 0;
        var scrollY = window.pageYOffset || 0;

        // px relative to canvas top-left
        var lx = (cx - (rect.left + scrollX)) / rect.width  * w;
        var ly = (cy - (rect.top  + scrollY)) / rect.height * h;

        var color = isDown ? '#ff4040' : '#00ddff';
        _cursorCtx.beginPath();
        _cursorCtx.arc(lx, ly, 22, 0, Math.PI * 2);
        _cursorCtx.strokeStyle = color;
        _cursorCtx.lineWidth   = 3;
        _cursorCtx.stroke();
        _cursorCtx.beginPath();
        _cursorCtx.arc(lx, ly, 5, 0, Math.PI * 2);
        _cursorCtx.fillStyle = color;
        _cursorCtx.fill();
    }

    function _drawLandmarks(results) {
        if (!_previewCtx || !GESTURE_CONFIG.showLandmarks) { return; }
        _previewCtx.clearRect(0, 0, _previewCvs.width, _previewCvs.height);
        if (!results.multiHandLandmarks) { return; }

        var CONN = (typeof HAND_CONNECTIONS !== 'undefined') ? HAND_CONNECTIONS : [];
        var w = _previewCvs.width, h = _previewCvs.height;

        results.multiHandLandmarks.forEach(function (lm) {
            CONN.forEach(function (c) {
                var a = lm[c[0]], b = lm[c[1]];
                if (!a || !b) { return; }
                _previewCtx.beginPath();
                _previewCtx.moveTo((1 - a.x) * w, a.y * h);
                _previewCtx.lineTo((1 - b.x) * w, b.y * h);
                _previewCtx.strokeStyle = 'rgba(0,220,255,0.8)';
                _previewCtx.lineWidth   = 1.5;
                _previewCtx.stroke();
            });
            lm.forEach(function (pt) {
                _previewCtx.beginPath();
                _previewCtx.arc((1 - pt.x) * w, pt.y * h, 3, 0, Math.PI * 2);
                _previewCtx.fillStyle = '#ff5050';
                _previewCtx.fill();
            });
        });
    }

    function _setStatus(text) {
        if (_statusDiv && GESTURE_CONFIG.showStatus) {
            _statusDiv.textContent = text;
        }
    }

    // ── Main MediaPipe callback ───────────────────────────────────────────
    function _onResults(results) {
        _drawLandmarks(results);

        var hands = results.multiHandLandmarks || [];

        if (hands.length === 0) {
            _fistFrames = 0; _openFrames = 0;
            if (_swipeState === STATE_DOWN) {
                _injectUp(_ptr.x, _ptr.y);
                _swipeState  = STATE_IDLE;
                _lastRelease = Date.now();
            }
            if (_cursorCtx) { _cursorCtx.clearRect(0, 0, _cursorCvs.width, _cursorCvs.height); }
            _setStatus('✋ Show your hand');
            _ptrBuf = [];
            return;
        }

        var lm    = hands[0];
        var multi = results.multiHandedness || [];
        var score = multi[0] && multi[0].score ? multi[0].score : 1;
        if (score < GESTURE_CONFIG.confidence) { _setStatus('🔍 Low confidence'); return; }

        // Pointer from index-finger tip (lm 8)
        var raw  = _toPageCoords(lm[8].x, lm[8].y);
        _ptr     = _smooth(raw.x, raw.y);

        // Draw cursor on overlay
        _drawCursor(_ptr.x, _ptr.y, _swipeState === STATE_DOWN);

        var fist = _isFist(lm);
        var open = _isOpen(lm);

        if (_swipeState === STATE_IDLE) {
            if (fist) {
                _fistFrames++;
                _setStatus('✊ Hold fist… (' + _fistFrames + '/' + FIST_HOLD + ')');
                if (_fistFrames >= FIST_HOLD) {
                    if (Date.now() - _lastRelease < COOLDOWN_MS) { return; }
                    _injectDown(_ptr.x, _ptr.y);
                    _swipeState = STATE_DOWN;
                    _fistFrames = 0;
                    _openFrames = 0;
                    _setStatus('✊ Drag to aim!');
                }
            } else {
                _fistFrames = 0;
                _setStatus('✋ Make a fist to grab');
            }
        } else {                          // STATE_DOWN
            if (open) {
                _openFrames++;
                _setStatus('🖐 Releasing… (' + _openFrames + '/' + OPEN_HOLD + ')');
                if (_openFrames >= OPEN_HOLD) {
                    _injectUp(_ptr.x, _ptr.y);
                    _swipeState  = STATE_IDLE;
                    _lastRelease = Date.now();
                    _openFrames  = 0;
                    _ptrBuf      = [];
                    _setStatus('⚽ SHOT!');
                    setTimeout(function () { _setStatus('✋ Make a fist to grab'); }, 900);
                }
            } else {
                _openFrames = 0;
                _injectMove(_ptr.x, _ptr.y);
                var canvasEl = document.getElementById('canvas');
                var cx = 0, cy = 0;
                if (canvasEl) {
                    var r = canvasEl.getBoundingClientRect();
                    cx = Math.round((_ptr.x - r.left - window.pageXOffset) / r.width  * CANVAS_WIDTH);
                    cy = Math.round((_ptr.y - r.top  - window.pageYOffset) / r.height * CANVAS_HEIGHT);
                }
                _setStatus('✊ Aim  x:' + cx + ' y:' + cy);
            }
        }
    }

    // ── DOM ───────────────────────────────────────────────────────────────
    function _buildDOM() {
        // Hidden webcam video thumbnail
        _videoEl              = document.createElement('video');
        _videoEl.style.cssText = 'position:fixed;bottom:10px;right:10px;' +
                                  'width:160px;height:120px;border-radius:8px;' +
                                  'border:2px solid rgba(0,200,255,.7);' +
                                  'transform:scaleX(-1);z-index:9000;opacity:.9;';
        _videoEl.autoplay     = true;
        _videoEl.muted        = true;
        _videoEl.playsInline  = true;
        document.body.appendChild(_videoEl);

        // Landmark overlay on top of thumbnail
        _previewCvs              = document.createElement('canvas');
        _previewCvs.width        = 160;
        _previewCvs.height       = 120;
        _previewCvs.style.cssText = 'position:fixed;bottom:10px;right:10px;' +
                                     'width:160px;height:120px;' +
                                     'transform:scaleX(-1);z-index:9001;pointer-events:none;';
        document.body.appendChild(_previewCvs);
        _previewCtx = _previewCvs.getContext('2d');

        // Full-screen cursor overlay (same dimensions as game canvas)
        _cursorCvs              = document.createElement('canvas');
        _cursorCvs.width        = CANVAS_WIDTH;
        _cursorCvs.height       = CANVAS_HEIGHT;
        _cursorCvs.style.cssText = 'position:absolute;top:0;left:0;' +
                                    'width:100%;height:100%;' +
                                    'pointer-events:none;z-index:500;';
        var gameCanvas = document.getElementById('canvas');
        if (gameCanvas && gameCanvas.parentNode) {
            gameCanvas.parentNode.insertBefore(_cursorCvs, gameCanvas.nextSibling);
        } else {
            document.body.appendChild(_cursorCvs);
        }
        _cursorCtx = _cursorCvs.getContext('2d');

        // Status label
        _statusDiv              = document.createElement('div');
        _statusDiv.style.cssText = 'position:fixed;bottom:138px;right:10px;' +
                                    'background:rgba(0,0,0,.75);color:#0df;' +
                                    'font:bold 12px monospace;padding:4px 8px;' +
                                    'border-radius:5px;z-index:9002;pointer-events:none;' +
                                    'min-width:160px;text-align:center;';
        _statusDiv.textContent   = '⏳ Starting camera…';
        document.body.appendChild(_statusDiv);
    }

    function _destroyDOM() {
        [_videoEl, _previewCvs, _cursorCvs, _statusDiv].forEach(function (el) {
            if (el && el.parentNode) { el.parentNode.removeChild(el); }
        });
        _videoEl = _previewCvs = _previewCtx = _cursorCvs = _cursorCtx = _statusDiv = null;
    }

    // ── Public API ────────────────────────────────────────────────────────
    function start() {
        if (!GESTURE_CONFIG.enabled) { return; }
        if (typeof Hands === 'undefined') {
            console.warn('[GestureManager] MediaPipe Hands not loaded.');
            return;
        }

        _buildDOM();

        _hands = new Hands({
            locateFile: function (f) {
                return 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/' + f;
            }
        });
        _hands.setOptions({
            maxNumHands:             1,
            modelComplexity:         1,
            minDetectionConfidence:  GESTURE_CONFIG.confidence,
            minTrackingConfidence:   GESTURE_CONFIG.confidence
        });
        _hands.onResults(_onResults);

        if (typeof Camera !== 'undefined') {
            _mpCamera = new Camera(_videoEl, {
                onFrame: function () { return _hands.send({ image: _videoEl }); },
                width:  GESTURE_CONFIG.cameraWidth,
                height: GESTURE_CONFIG.cameraHeight
            });
            _mpCamera.start()
                .then(function () {
                    _running = true;
                    _setStatus('✋ Make a fist to grab');
                    console.log('[GestureManager] Ready.');
                })
                .catch(function (e) {
                    console.warn('[GestureManager] Camera failed:', e.message || e);
                    _destroyDOM();
                });
        } else {
            navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
            }).then(function (stream) {
                _videoEl.srcObject = stream;
                _videoEl.onloadedmetadata = function () {
                    _videoEl.play();
                    _running = true;
                    _setStatus('✋ Make a fist to grab');
                    console.log('[GestureManager] Ready (manual RAF).');
                    _rafLoop();
                };
            }).catch(function (e) {
                console.warn('[GestureManager] Webcam denied:', e.message || e);
                _destroyDOM();
            });
        }
    }

    function _rafLoop() {
        if (!_running) { return; }
        _hands.send({ image: _videoEl })
              .then(function () { requestAnimationFrame(_rafLoop); })
              .catch(function () { requestAnimationFrame(_rafLoop); });
    }

    function stop() {
        _running = false;
        if (_mpCamera) { try { _mpCamera.stop(); } catch (e) {} _mpCamera = null; }
        if (_videoEl && _videoEl.srcObject) {
            _videoEl.srcObject.getTracks().forEach(function (t) { t.stop(); });
        }
        if (_hands) { try { _hands.close(); } catch (e) {} _hands = null; }
        _destroyDOM();
    }

    function isRunning() { return _running; }

    return { start: start, stop: stop, isRunning: isRunning };
}());
