/**
 * BallGrabSystem.js  –  OK gesture 👌 grab + drag + shoot
 *
 * Debug HUD is shown (top-left corner) so you can see:
 *   • Whether MediaPipe detects a hand
 *   • Live pinch distance value
 *   • Current state (IDLE / HOVER / GRABBED / SHOT)
 * Once everything works the HUD can be hidden by setting DEBUG_HUD = false.
 */

var BallGrabSystem = (function () {

    // ── Config ────────────────────────────────────────────────────────────
    var DEBUG_HUD         = true;   // set false to hide the debug panel
    var PINCH_ON          = 0.10;   // normalised units – thumb/index must be closer than this
    var PINCH_OFF         = 0.14;   // must be further than this to release
    var GRAB_RADIUS_PX    = 130;    // canvas-logical px to ball centre
    var MIN_DRAG_UP_PX    = 20;     // minimum upward canvas-px to count as a shot
    var SHOT_COOLDOWN_MS  = 500;
    var SYNTH_LIFT_PX     = 70;    // synthetic upward px when hand barely moved
    var SMOOTH_N          = 5;

    // ── State ─────────────────────────────────────────────────────────────
    var S_IDLE    = 'IDLE';
    var S_HOVER   = 'HOVER';
    var S_GRABBED = 'GRABBED';
    var _state    = S_IDLE;
    var _running  = false;

    // MediaPipe
    var _hands    = null;
    var _mpCamera = null;
    var _videoEl  = null;

    // Drag
    var _grabPage     = null;
    var _grabHandPage = null;   // hand position at grab time — used for aim direction
    var _curPage      = null;
    var _grabTime     = 0;
    var _lastShot     = 0;

    // Smoothing
    var _buf = [];

    // Debounce
    var _pinchOnFrames  = 0;
    var _pinchOffFrames = 0;
    var _pinchState     = false;   // true = currently pinching

    // FX
    var _glowShape  = null;
    var _lockText   = null;
    var _glowPhase  = 0;
    var _fxRafId    = null;

    // Debug HUD DOM element
    var _hud = null;

    // Cursor dot on game canvas (EaselJS layer — kept for legacy)
    var _cursorDot = null;

    // DOM-based reticle overlay — always visible on top
    var _reticle = null;

    // ── Geometry helpers ──────────────────────────────────────────────────
    function _canvasEl() { return document.getElementById('canvas'); }

    function _normToPage(nx, ny) {
        var el = _canvasEl(); if (!el) { return {x:0,y:0}; }
        var r  = el.getBoundingClientRect();
        var sx = window.pageXOffset || 0, sy = window.pageYOffset || 0;
        return { x: r.left + sx + (1 - nx) * r.width,
                 y: r.top  + sy +       ny  * r.height };
    }

    function _pageToCanvas(px, py) {
        var el = _canvasEl(); if (!el) { return {x:0,y:0}; }
        var r  = el.getBoundingClientRect();
        var sx = window.pageXOffset || 0, sy = window.pageYOffset || 0;
        return { x: ((px - r.left - sx) / r.width)  * CANVAS_WIDTH,
                 y: ((py - r.top  - sy) / r.height) * CANVAS_HEIGHT };
    }

    function _canvasToPage(cx, cy) {
        var el = _canvasEl(); if (!el) { return {x:0,y:0}; }
        var r  = el.getBoundingClientRect();
        var sx = window.pageXOffset || 0, sy = window.pageYOffset || 0;
        return { x: r.left + sx + (cx / CANVAS_WIDTH)  * r.width,
                 y: r.top  + sy + (cy / CANVAS_HEIGHT) * r.height };
    }

    function _ballCanvas() {
        return { x: CANVAS_WIDTH_HALF + 55, y: CANVAS_HEIGHT_HALF + 168 };
    }

    function _dist(a, b) {
        var dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy);
    }

    function _smooth(nx, ny) {
        _buf.push({x:nx, y:ny});
        if (_buf.length > SMOOTH_N) { _buf.shift(); }
        var sx=0, sy=0;
        for (var i=0; i<_buf.length; i++) { sx+=_buf[i].x; sy+=_buf[i].y; }
        return { x: sx/_buf.length, y: sy/_buf.length };
    }

    // ── EaselJS injection ─────────────────────────────────────────────────
    function _fakeEv(px, py) {
        return { pageX:px, pageY:py, clientX:px, clientY:py,
                 preventDefault:function(){}, stopPropagation:function(){} };
    }

    function _setMouse(px, py) {
        if (!window.s_oStage) { return; }
        var c = _pageToCanvas(px, py);
        s_oStage.mouseX = c.x;
        s_oStage.mouseY = c.y;
    }

    function _injectDown(px, py) {
        if (!window.s_oStage) { return; }
        _setMouse(px, py);
        try { s_oStage._handlePointerDown(-1, _fakeEv(px,py), px, py); }
        catch(e) { console.warn('[BGS] Down error:', e.message); }
    }

    function _injectMove(px, py) {
        if (!window.s_oStage) { return; }
        _setMouse(px, py);
        try { s_oStage._handlePointerMove(-1, _fakeEv(px,py), px, py); }
        catch(e) {}
    }

    function _injectUp(px, py) {
        if (!window.s_oStage) { return; }
        _setMouse(px, py);
        try { s_oStage._handlePointerUp(-1, _fakeEv(px,py), false); }
        catch(e) { console.warn('[BGS] Up error:', e.message); }
    }

    // ── Visual FX ─────────────────────────────────────────────────────────
    function _initFX() {
        if (_glowShape || !window.s_oStage) { return; }
        _glowShape = new createjs.Shape();
        _glowShape.mouseEnabled = false;
        s_oStage.addChild(_glowShape);

        _lockText = new createjs.Text('🔒', 'bold 22px sans-serif', '#fff');
        _lockText.textAlign = 'center';
        _lockText.textBaseline = 'middle';
        _lockText.mouseEnabled = false;
        _lockText.visible = false;
        s_oStage.addChild(_lockText);

        // DOM reticle — rendered on top of everything via fixed position
        if (!_reticle) {
            _reticle = document.createElement('div');
            _reticle.id = 'bgs-reticle';
            _reticle.style.cssText = [
                'position:fixed',
                'width:64px',
                'height:64px',
                'pointer-events:none',
                'z-index:999999',
                'transform:translate(-50%,-50%)',
                'display:none',
                'transition:border-color 0.1s,box-shadow 0.1s'
            ].join(';');
            // Outer ring
            _reticle.innerHTML =
                '<svg width="64" height="64" viewBox="0 0 64 64" id="bgs-reticle-svg">' +
                  '<circle cx="32" cy="32" r="28" fill="none" stroke-width="2.5" id="bgs-ring"/>' +
                  '<circle cx="32" cy="32" r="5"  fill="white" id="bgs-dot"/>' +
                  // crosshair lines
                  '<line x1="32" y1="8"  x2="32" y2="22" stroke-width="2" id="bgs-ln-t"/>' +
                  '<line x1="32" y1="42" x2="32" y2="56" stroke-width="2" id="bgs-ln-b"/>' +
                  '<line x1="8"  y1="32" x2="22" y2="32" stroke-width="2" id="bgs-ln-l"/>' +
                  '<line x1="42" y1="32" x2="56" y2="32" stroke-width="2" id="bgs-ln-r"/>' +
                  // label
                  '<text x="32" y="62" text-anchor="middle" font-size="8" font-family="Arial,sans-serif" font-weight="bold" id="bgs-label">PINCH 👌</text>' +
                '</svg>';
            document.body.appendChild(_reticle);
        }
    }

    // Update the DOM reticle position and color each FX tick
    function _updateReticle() {
        if (!_reticle) { return; }
        if (!_curPage) { _reticle.style.display = 'none'; return; }

        _reticle.style.display = 'block';
        _reticle.style.left = _curPage.x + 'px';
        _reticle.style.top  = _curPage.y + 'px';

        var color, glowColor, labelText, dotColor;
        if (_state === S_GRABBED) {
            color     = '#00ff8c';
            glowColor = 'rgba(0,255,140,0.7)';
            labelText = 'DRAG UP ⬆';
            dotColor  = '#00ff8c';
        } else if (_state === S_HOVER) {
            color     = '#ffd600';
            glowColor = 'rgba(255,214,0,0.6)';
            labelText = 'PINCH 👌';
            dotColor  = '#ffd600';
        } else {
            color     = 'rgba(255,255,255,0.85)';
            glowColor = 'rgba(255,255,255,0.25)';
            labelText = 'PINCH 👌';
            dotColor  = 'white';
        }

        var svg = _reticle.querySelector('#bgs-reticle-svg');
        if (svg) {
            var ring  = svg.querySelector('#bgs-ring');
            var dot   = svg.querySelector('#bgs-dot');
            var label = svg.querySelector('#bgs-label');
            var lines = [svg.querySelector('#bgs-ln-t'), svg.querySelector('#bgs-ln-b'),
                         svg.querySelector('#bgs-ln-l'), svg.querySelector('#bgs-ln-r')];
            if (ring)  { ring.setAttribute('stroke', color); ring.setAttribute('filter', 'drop-shadow(0 0 6px ' + glowColor + ')'); }
            if (dot)   { dot.setAttribute('fill', dotColor); }
            if (label) { label.setAttribute('fill', color); label.textContent = labelText; }
            lines.forEach(function(l){ if(l){ l.setAttribute('stroke', color); } });
        }
    }

    function _drawGlow(x, y, alpha, r, g, b) {
        if (!_glowShape) { return; }
        _glowShape.graphics.clear();
        if (alpha <= 0) { return; }
        var c = 'rgba('+r+','+g+','+b+',';
        _glowShape.graphics
            .beginRadialGradientFill([c+(alpha*0.5)+')', c+'0)'], [0,1], x,y,8, x,y,80)
            .drawCircle(x, y, 80);
        _glowShape.graphics
            .setStrokeStyle(2.5)
            .beginStroke(c+Math.min(1,alpha*1.4)+')')
            .drawCircle(x, y, 52);
    }

    function _clearFX() {
        if (_glowShape) { _glowShape.graphics.clear(); }
        if (_lockText)  { _lockText.visible = false; }
    }

    function _fxTick() {
        if (!_running) { return; }
        _fxRafId = requestAnimationFrame(_fxTick);
        _glowPhase += 0.07;
        var ball = _ballCanvas();

        if (_state === S_HOVER) {
            var a = 0.4 + 0.3 * Math.sin(_glowPhase);
            _drawGlow(ball.x, ball.y, a, 255, 215, 0);
            if (_lockText) { _lockText.visible = false; }
        } else if (_state === S_GRABBED) {
            _drawGlow(ball.x, ball.y, 0.9, 0, 240, 140);
            if (_lockText) {
                _lockText.x = ball.x; _lockText.y = ball.y - 65;
                _lockText.visible = true;
            }
        } else {
            _clearFX();
        }

        // Update DOM reticle overlay
        _updateReticle();
    }

    // ── Debug HUD ─────────────────────────────────────────────────────────
    function _initHUD() {
        if (!DEBUG_HUD || _hud) { return; }
        _hud = document.createElement('div');
        _hud.style.cssText =
            'position:fixed;top:10px;left:10px;z-index:99999;' +
            'background:rgba(0,0,0,0.75);color:#0ff;' +
            'font:bold 13px monospace;padding:8px 12px;border-radius:6px;' +
            'pointer-events:none;line-height:1.6;min-width:220px;';
        _hud.innerHTML = '👁 BallGrabSystem loading…';
        document.body.appendChild(_hud);
    }

    function _updateHUD(lines) {
        if (!_hud) { return; }
        _hud.innerHTML = lines.join('<br>');
    }

    // ── Gesture detection ─────────────────────────────────────────────────
    function _processPinch(lm) {
        var tx=lm[4].x, ty=lm[4].y;
        var ix=lm[8].x, iy=lm[8].y;
        var d = Math.sqrt((tx-ix)*(tx-ix)+(ty-iy)*(ty-iy));

        // Extended fingers: tip.y < pip.y
        var ext = 0;
        if (lm[12].y < lm[10].y) { ext++; }
        if (lm[16].y < lm[14].y) { ext++; }
        if (lm[20].y < lm[18].y) { ext++; }

        var wantOn  = (d < PINCH_ON);   // pinch distance alone is sufficient — other fingers may curl
        var wantOff = (d > PINCH_OFF);

        if (_pinchState) {
            if (wantOff) {
                _pinchOffFrames++;
                _pinchOnFrames = 0;
                if (_pinchOffFrames >= 2) { _pinchState = false; _pinchOffFrames = 0; _buf = []; }
            } else { _pinchOffFrames = 0; }
        } else {
            if (wantOn) {
                _pinchOnFrames++;
                _pinchOffFrames = 0;
                if (_pinchOnFrames >= 2) { _pinchState = true; _pinchOnFrames = 0; }
            } else { _pinchOnFrames = 0; }
        }

        var rawCursor = _smooth((tx+ix)*0.5, (ty+iy)*0.5);
        return { pinching: _pinchState, cursor: rawCursor, dist: d, ext: ext };
    }

    // ── Main results handler ──────────────────────────────────────────────
    function _onResults(results) {
        if (!window.s_oStage) { return; }
        _initFX();

        var hands  = results.multiHandLandmarks  || [];
        var multi  = results.multiHandedness     || [];
        var lm     = hands.length > 0 ? hands[0] : null;
        var score  = (multi[0] && multi[0].score) ? multi[0].score : 0;

        if (lm && score < 0.6) { lm = null; }

        // ── No hand ────────────────────────────────────────────────────
        if (!lm) {
            _pinchOnFrames = 0; _pinchOffFrames = 0; _buf = [];
            if (_state === S_GRABBED && _curPage) {
                _injectUp(_curPage.x, _curPage.y);
            }
            _state = S_IDLE;
            _curPage = null;   // hide cursor dot
            _updateHUD(['👁 No hand detected', 'State: ' + _state]);
            return;
        }

        var p      = _processPinch(lm);
        var pagePt = _normToPage(p.cursor.x, p.cursor.y);
        var cvPt   = _pageToCanvas(pagePt.x, pagePt.y);
        var ball   = _ballCanvas();
        var dBall  = _dist(cvPt, ball);
        var near   = dBall < GRAB_RADIUS_PX;

        // Always update cursor position so dot tracks hand
        _curPage = { x: pagePt.x, y: pagePt.y };

        // Update HUD
        _updateHUD([
            '✋ Hand detected  conf:' + score.toFixed(2),
            'Pinch dist: <b style="color:' + (p.pinching?'#0f0':'#f80') + '">' + p.dist.toFixed(3) + '</b>  (need &lt;' + PINCH_ON + ')',
            'Ext fingers: ' + p.ext + '  Near ball: ' + (near ? '✅':'❌') + ' (' + Math.round(dBall) + 'px)',
            'Pinching: <b>' + (p.pinching ? '✅ YES':'❌ NO') + '</b>',
            'State: <b style="color:#ff0">' + _state + '</b>'
        ]);

        // ── State machine ──────────────────────────────────────────────
        // RULE: pinch near ball = grab (mousedown AT ball center), open hand = shoot
        switch (_state) {

            case S_IDLE:
            case S_HOVER:
                _state = near ? S_HOVER : S_IDLE;
                if (near && p.pinching && (Date.now() - _lastShot > SHOT_COOLDOWN_MS)) {
                    // Always inject mousedown at the BALL CENTER — not hand position
                    // This guarantees EaselJS hit-test passes every time
                    var ballPg    = _canvasToPage(ball.x, ball.y);
                    _grabPage     = { x: ballPg.x, y: ballPg.y };
                    _grabHandPage = { x: pagePt.x, y: pagePt.y };  // track hand for direction
                    _curPage      = { x: pagePt.x, y: pagePt.y };
                    _grabTime     = Date.now();
                    _state        = S_GRABBED;
                    _injectDown(ballPg.x, ballPg.y);
                    console.log('[BGS] GRABBED at ball center');
                }
                break;

            case S_GRABBED:
                // Hand lost mid-grab → fire straight shot upward from ball
                if (!p.cursor) {
                    var synthPg0 = _canvasToPage(ball.x, ball.y - SYNTH_LIFT_PX);
                    _injectMove(synthPg0.x, synthPg0.y);
                    _injectUp(synthPg0.x, synthPg0.y);
                    console.log('[BGS] ⚽ SHOT (hand lost – synth)');
                    _lastShot = Date.now();
                    _state = S_IDLE; _pinchState = false; _buf = [];
                    break;
                }

                _curPage = { x: pagePt.x, y: pagePt.y };

                if (!p.pinching) {
                    // Compute how far hand moved upward from grab point
                    var grabHandCV = _pageToCanvas(_grabHandPage.x, _grabHandPage.y);
                    var curCV      = _pageToCanvas(_curPage.x, _curPage.y);
                    var dy         = grabHandCV.y - curCV.y;   // positive = hand moved up
                    var dx         = curCV.x - grabHandCV.x;   // negative = left, positive = right

                    var shotPageX, shotPageY;
                    if (dy > 5) {
                        // Hand moved upward — aim the shot in that direction from ball center
                        var aimCV  = { x: ball.x + dx, y: ball.y - dy };
                        var aimPg  = _canvasToPage(aimCV.x, aimCV.y);
                        shotPageX  = aimPg.x;
                        shotPageY  = aimPg.y;
                        console.log('[BGS] ⚽ SHOT (aimed dy=' + Math.round(dy) + ' dx=' + Math.round(dx) + ')');
                    } else {
                        // No upward movement — fire straight center shot
                        var ctrPg  = _canvasToPage(ball.x, ball.y - SYNTH_LIFT_PX);
                        shotPageX  = ctrPg.x;
                        shotPageY  = ctrPg.y;
                        console.log('[BGS] ⚽ SHOT (center synth)');
                    }

                    _injectMove(shotPageX, shotPageY);
                    _injectUp(shotPageX, shotPageY);
                    _lastShot = Date.now();
                    _state    = S_IDLE;
                    _buf      = [];
                }
                // Don't inject move while pinching — just wait for release
                break;
        }
    }

    // ── Boot ──────────────────────────────────────────────────────────────
    function start() {
        if (_running) { return; }

        if (typeof Hands === 'undefined') {
            console.warn('[BGS] MediaPipe not loaded.');
            return;
        }

        _initHUD();
        _updateHUD(['⏳ Requesting camera…']);

        _videoEl = document.createElement('video');
        _videoEl.setAttribute('playsinline', '');
        _videoEl.muted = true;
        _videoEl.style.cssText =
            'position:fixed;width:1px;height:1px;opacity:0.01;' +
            'top:0;left:0;pointer-events:none;z-index:-1;';
        document.body.appendChild(_videoEl);

        _hands = new Hands({
            locateFile: function (f) {
                return 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/' + f;
            }
        });
        _hands.setOptions({
            maxNumHands:             1,
            modelComplexity:         1,
            minDetectionConfidence:  0.70,
            minTrackingConfidence:   0.60
        });
        _hands.onResults(_onResults);

        if (typeof Camera !== 'undefined') {
            _mpCamera = new Camera(_videoEl, {
                onFrame: function () { return _hands.send({ image: _videoEl }); },
                width: 640, height: 480
            });
            _mpCamera.start()
                .then(function () {
                    _running = true;
                    _fxTick();
                    _updateHUD(['✅ Camera active', 'Make 👌 over the ball']);
                    console.log('[BGS] Ready – make OK gesture 👌 over the ball');
                })
                .catch(function (e) {
                    console.warn('[BGS] Camera failed:', e.message);
                    _updateHUD(['❌ Camera failed:', e.message]);
                    _cleanup();
                });
        } else {
            navigator.mediaDevices.getUserMedia({ video: { facingMode:'user' } })
                .then(function (stream) {
                    _videoEl.srcObject = stream;
                    _videoEl.play().then(function () {
                        _running = true;
                        _fxTick();
                        _updateHUD(['✅ Camera active (manual)', 'Make 👌 over the ball']);
                        console.log('[BGS] Ready (manual RAF)');
                        _rafLoop();
                    });
                })
                .catch(function (e) {
                    console.warn('[BGS] Webcam denied – gestures disabled.', e.message);
                    _updateHUD(['❌ Webcam denied', 'Mouse controls still work']);
                    _cleanup();
                });
        }
    }

    function _rafLoop() {
        if (!_running) { return; }
        _hands.send({ image: _videoEl })
              .then(function () { requestAnimationFrame(_rafLoop); })
              .catch(function () { requestAnimationFrame(_rafLoop); });
    }

    function _cleanup() {
        if (_videoEl && _videoEl.parentNode) { _videoEl.parentNode.removeChild(_videoEl); }
        _videoEl = null;
    }

    function stop() {
        _running = false;
        if (_fxRafId) { cancelAnimationFrame(_fxRafId); _fxRafId = null; }
        if (_mpCamera) { try { _mpCamera.stop(); } catch(e){} _mpCamera = null; }
        if (_videoEl && _videoEl.srcObject) {
            _videoEl.srcObject.getTracks().forEach(function(t){t.stop();});
        }
        if (_hands) { try { _hands.close(); } catch(e){} _hands = null; }
        _clearFX();
        if (_reticle && _reticle.parentNode) { _reticle.parentNode.removeChild(_reticle); _reticle = null; }
        _cleanup();
    }

    function isRunning() { return _running; }

    return { start:start, stop:stop, isRunning:isRunning };
}());
