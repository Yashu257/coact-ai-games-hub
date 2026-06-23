/**
 * CHandGesture.js
 * Finger-pose based gesture controller using MediaPipe Hands.
 *
 * Gesture → Direction mapping:
 *   ☝️  Index finger only up          → MOVE UP
 *   👍  Thumb only pointing left/up   → MOVE DOWN
 *   👈  Index finger pointing left    → MOVE LEFT
 *   ✌️  Index + Middle fingers up     → MOVE RIGHT
 *   ✊  Fist (all fingers curled)      → PAUSE / RESUME
 */
function CHandGesture(oGame) {

    var _oGame    = oGame;
    var _oVideo   = null;
    var _oMirror  = null;   // canvas for mirrored video preview
    var _oMirCtx  = null;
    var _oDotCvs  = null;   // canvas for landmark dots
    var _oDotCtx  = null;
    var _oOverlay = null;
    var _oHands   = null;
    var _oCamera  = null;
    var _bRunning = false;
    var _bPaused  = false;   // tracks whether game is currently paused by fist
    var _bBlocked = false;   // true while palm is shown — suppresses all moves

    // How long (ms) to hold a gesture before it fires — prevents noise
    var HOLD_MS      = 180;
    var COOLDOWN_MS  = 280;   // lockout after a move fires

    var _szLastGesture  = '';
    var _iGestureStart  = 0;
    var _bCooldown      = false;

    // ─── Landmark indices (MediaPipe 21-point model) ──────────────────────────
    // Finger tip indices: thumb=4, index=8, middle=12, ring=16, pinky=20
    // Finger pip indices: thumb=3, index=6, middle=10, ring=14, pinky=18
    var TIP  = { thumb:4, index:8, middle:12, ring:16, pinky:20 };
    var PIP  = { thumb:2, index:6, middle:10, ring:14, pinky:18 };
    var MCP  = { thumb:2, index:5, middle:9,  ring:13, pinky:17 };
    var WRIST = 0;

    // ─── Gesture recognition ─────────────────────────────────────────────────

    /**
     * Returns true if the named finger is extended (tip above pip in Y,
     * remembering Y=0 is top of image so "above" means smaller Y value).
     */
    function _isFingerUp(lm, finger) {
        return lm[TIP[finger]].y < lm[PIP[finger]].y;
    }

    /**
     * Returns true if thumb tip is to the LEFT of thumb mcp
     * (in mirrored camera space this means user's thumb points left visually).
     */
    function _isThumbLeft(lm) {
        return lm[TIP.thumb].x > lm[MCP.thumb].x;
    }

    /**
     * Classify the current landmark set into one of:
     *   'up' | 'down' | 'left' | 'right' | ''
     *
     * Rules:
     *   UP    — index up, middle/ring/pinky curled, thumb anything
     *   DOWN  — thumb up/extended, index/middle/ring/pinky all curled
     *   LEFT  — index pointing sideways left (tip.x < mcp.x in raw space),
     *            other fingers curled
     *   RIGHT — index + middle both up, ring + pinky curled
     */
    function _classify(lm) {
        var idxUp   = _isFingerUp(lm, 'index');
        var midUp   = _isFingerUp(lm, 'middle');
        var ringUp  = _isFingerUp(lm, 'ring');
        var pinkyUp = _isFingerUp(lm, 'pinky');

        // Stricter thumb: compare tip to MCP base so tucked thumb reads curled
        var thumbUp = lm[TIP.thumb].y < lm[MCP.thumb].y - 0.03;

        // 🖐 PALM — all 5 fingers open/extended → STOP (checked first)
        if (idxUp && midUp && ringUp && pinkyUp) {
            return 'palm';
        }

        // ✊  FIST — all four fingers curled AND thumb not extended
        if (!idxUp && !midUp && !ringUp && !pinkyUp && !thumbUp) {
            return 'fist';
        }

        // ✌️  RIGHT — index + middle up, ring + pinky down
        if (idxUp && midUp && !ringUp && !pinkyUp) {
            return 'right';
        }

        // ☝️  UP / LEFT — only index up
        if (idxUp && !midUp && !ringUp && !pinkyUp) {
            var tipX = lm[TIP.index].x;
            var mcpX = lm[MCP.index].x;
            var dx   = tipX - mcpX;
            var dy   = lm[TIP.index].y - lm[MCP.index].y;

            // Mostly horizontal → LEFT (mirrored: dx > 0 = user pointing left)
            // Lowered dx threshold from 0.04 → 0.025 for easier lateral detection
            if (Math.abs(dx) > Math.abs(dy) * 1.0) {
                if (dx > 0.025) return 'left';
            }

            // Mostly vertical and tip well above wrist → UP
            if (lm[TIP.index].y < lm[WRIST].y - 0.08) return 'up';
        }

        // 👍  DOWN — thumb clearly extended, ALL four fingers curled
        if (thumbUp && !idxUp && !midUp && !ringUp && !pinkyUp) {
            return 'down';
        }

        return '';
    }

    // ─── Build UI ─────────────────────────────────────────────────────────────

    function _buildUI() {
        // ── Instructions panel (top-left) ──────────────────────────────────
        var oInstr = document.createElement('div');
        oInstr.id = 'hg-instructions';
        oInstr.style.cssText = [
            'position:fixed',
            'top:12px',
            'left:12px',
            'z-index:9999',
            'background:rgba(0,0,0,0.72)',
            'border:2px solid rgba(0,255,136,0.5)',
            'border-radius:12px',
            'padding:10px 14px',
            'font-family:Arial,sans-serif',
            'color:#fff',
            'font-size:13px',
            'line-height:1.7',
            'pointer-events:none',
            'min-width:190px'
        ].join(';');
        oInstr.innerHTML = [
            '<div style="font-size:14px;font-weight:bold;color:#00ff88;margin-bottom:6px">✋ Hand Controls</div>',
            '<div><span style="font-size:20px">☝️</span>  Index finger up  <b style="color:#00ff88">↑ UP</b></div>',
            '<div><span style="font-size:20px">👍</span>  Thumb up          <b style="color:#00ff88">↓ DOWN</b></div>',
            '<div><span style="font-size:20px">👈</span>  Index point left  <b style="color:#00ff88">← LEFT</b></div>',
            '<div><span style="font-size:20px">✌️</span>  Two fingers up    <b style="color:#00ff88">→ RIGHT</b></div>',
            '<div><span style="font-size:20px">🖐</span>  Open palm         <b style="color:#ff9900">⛔ STOP</b></div>',
            '<div id="hg-detected" style="margin-top:8px;font-size:12px;color:#aaa">Waiting for hand…</div>'
        ].join('');
        document.body.appendChild(oInstr);

        // ── Camera preview (bottom-right) ──────────────────────────────────
        _oOverlay = document.createElement('div');
        _oOverlay.id = 'hg-cam-overlay';
        _oOverlay.style.cssText = [
            'position:fixed',
            'bottom:12px',
            'right:12px',
            'width:180px',
            'z-index:9999',
            'background:rgba(0,0,0,0.6)',
            'border:2px solid rgba(0,255,136,0.4)',
            'border-radius:10px',
            'padding:6px',
            'font-family:Arial,sans-serif'
        ].join(';');

        // Hidden video source
        _oVideo = document.createElement('video');
        _oVideo.setAttribute('playsinline', '');
        _oVideo.muted = true;
        _oVideo.style.cssText = 'display:none;';
        _oOverlay.appendChild(_oVideo);

        // Mirrored canvas showing video + dots
        _oMirror = document.createElement('canvas');
        _oMirror.width  = 180;
        _oMirror.height = 135;
        _oMirror.style.cssText = 'width:100%;border-radius:6px;display:block;';
        _oOverlay.appendChild(_oMirror);
        _oMirCtx = _oMirror.getContext('2d');

        // Status bar
        var oStatus = document.createElement('div');
        oStatus.id = 'hg-cam-status';
        oStatus.style.cssText = 'color:#aaa;font-size:11px;text-align:center;margin-top:5px;';
        oStatus.textContent = 'Camera loading…';
        _oOverlay.appendChild(oStatus);

        document.body.appendChild(_oOverlay);
    }

    function _setDetected(szText, szColor) {
        var oEl = document.getElementById('hg-detected');
        if (oEl) {
            oEl.textContent = szText;
            oEl.style.color = szColor || '#aaa';
        }
    }

    function _setCamStatus(szText) {
        var oEl = document.getElementById('hg-cam-status');
        if (oEl) oEl.textContent = szText;
    }

    // ─── Result handler ───────────────────────────────────────────────────────

    function _onResults(results) {
        // Draw mirrored video frame
        _oMirCtx.save();
        _oMirCtx.translate(_oMirror.width, 0);
        _oMirCtx.scale(-1, 1);
        _oMirCtx.drawImage(results.image, 0, 0, _oMirror.width, _oMirror.height);
        _oMirCtx.restore();

        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            _szLastGesture = '';
            _setDetected('Show your hand 👋', '#aaa');
            _setCamStatus('No hand detected');
            return;
        }

        var lm = results.multiHandLandmarks[0];

        // Draw landmark skeleton on mirror canvas
        _drawSkeleton(lm);

        // Classify
        var szGesture = _classify(lm);

        if (!szGesture) {
            _szLastGesture = '';
            _iGestureStart = 0;
            // If coming back from palm, unblock movement
            if (_bBlocked) {
                _bBlocked = false;
                _bCooldown = false;
                _setDetected('Hold a gesture…', '#aaa');
            } else {
                _setDetected('Hold a gesture…', '#aaa');
            }
            _setCamStatus('✋ Ready');
            return;
        }

        // 🖐 PALM — instant block, no hold timer needed
        if (szGesture === 'palm') {
            if (!_bBlocked) {
                _bBlocked = true;
                _bCooldown = true;   // prevent any queued move from firing
                _szLastGesture = 'palm';
                _setDetected('🖐 STOP — show gesture to move', '#ff9900');
                _setCamStatus('🖐 Stopped');
            }
            return;
        }

        // Any non-palm gesture unblocks
        if (_bBlocked) {
            _bBlocked  = false;
            _bCooldown = false;
        }

        // Track how long same gesture is held
        if (szGesture !== _szLastGesture) {
            _szLastGesture = szGesture;
            _iGestureStart = Date.now();
        }

        var iHeld = Date.now() - _iGestureStart;
        var iPct  = Math.min(100, Math.round(iHeld / HOLD_MS * 100));

        // Show progress feedback
        var aLabels = { up:'☝️ UP', down:'👍 DOWN', left:'👈 LEFT', right:'✌️ RIGHT', fist:'✊ FIST' };
        _setDetected((aLabels[szGesture] || szGesture) + '  [' + iPct + '%]', '#ffdd00');

        if (!_bCooldown && iHeld >= HOLD_MS) {
            _fireMove(szGesture);
        }
    }

    // ─── Draw skeleton ────────────────────────────────────────────────────────

    var CONNECTIONS = [
        [0,1],[1,2],[2,3],[3,4],           // thumb
        [0,5],[5,6],[6,7],[7,8],           // index
        [0,9],[9,10],[10,11],[11,12],      // middle
        [0,13],[13,14],[14,15],[15,16],    // ring
        [0,17],[17,18],[18,19],[19,20],    // pinky
        [5,9],[9,13],[13,17]               // palm
    ];

    function _lmToCanvas(lm, idx) {
        return {
            x: (1 - lm[idx].x) * _oMirror.width,
            y: lm[idx].y * _oMirror.height
        };
    }

    function _drawSkeleton(lm) {
        // Lines
        _oMirCtx.strokeStyle = 'rgba(0,255,136,0.7)';
        _oMirCtx.lineWidth = 1.5;
        for (var c = 0; c < CONNECTIONS.length; c++) {
            var a = _lmToCanvas(lm, CONNECTIONS[c][0]);
            var b = _lmToCanvas(lm, CONNECTIONS[c][1]);
            _oMirCtx.beginPath();
            _oMirCtx.moveTo(a.x, a.y);
            _oMirCtx.lineTo(b.x, b.y);
            _oMirCtx.stroke();
        }
        // Dots on tips
        _oMirCtx.fillStyle = '#ffffff';
        var aTips = [TIP.thumb, TIP.index, TIP.middle, TIP.ring, TIP.pinky];
        for (var t = 0; t < aTips.length; t++) {
            var p = _lmToCanvas(lm, aTips[t]);
            _oMirCtx.beginPath();
            _oMirCtx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
            _oMirCtx.fill();
        }
        // Wrist dot
        var w = _lmToCanvas(lm, WRIST);
        _oMirCtx.fillStyle = '#00ff88';
        _oMirCtx.beginPath();
        _oMirCtx.arc(w.x, w.y, 4, 0, Math.PI * 2);
        _oMirCtx.fill();
    }

    // ─── Fire move ────────────────────────────────────────────────────────────

    function _fireMove(szDir) {
        if (_bCooldown || _bBlocked || !_oGame) return;
        _bCooldown = true;
        _szLastGesture = '';
        _iGestureStart = 0;

        var aLabels = { up:'☝️ → JUMP UP', down:'👍 → JUMP DOWN', left:'👈 → JUMP LEFT', right:'✌️ → JUMP RIGHT' };
        _setDetected(aLabels[szDir] || szDir, '#00ff88');

        switch (szDir) {
            case 'up':    _oGame.onUpPress(200);    break;
            case 'down':  _oGame.onDownPress(200);  break;
            case 'left':  _oGame.onLeftPress(200);  break;
            case 'right': _oGame.onRightPress(200); break;
        }

        setTimeout(function () {
            _bCooldown = false;
            _setDetected('Hold a gesture…', '#aaa');
        }, COOLDOWN_MS);
    }

    // ─── Start / Stop ─────────────────────────────────────────────────────────

    this.start = function () {
        if (_bRunning) return;
        _bRunning = true;

        _buildUI();

        _oHands = new Hands({
            locateFile: function (file) {
                return 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/' + file;
            }
        });

        _oHands.setOptions({
            maxNumHands: 1,
            modelComplexity: 0,
            minDetectionConfidence: 0.65,
            minTrackingConfidence:  0.55
        });

        _oHands.onResults(_onResults);

        _oCamera = new Camera(_oVideo, {
            onFrame: async function () {
                await _oHands.send({ image: _oVideo });
            },
            width: 320,
            height: 240
        });

        _oCamera.start().then(function () {
            _setCamStatus('✋ Show hand');
        }).catch(function (err) {
            _setCamStatus('⚠ Camera denied');
            _setDetected('Enable camera to use gestures', '#ff6666');
            console.warn('CHandGesture: camera error', err);
        });
    };

    this.stop = function () {
        if (!_bRunning) return;
        _bRunning = false;

        if (_oCamera) { _oCamera.stop(); _oCamera = null; }
        if (_oHands)  { _oHands.close(); _oHands  = null; }

        var oInstr = document.getElementById('hg-instructions');
        if (oInstr && oInstr.parentNode) oInstr.parentNode.removeChild(oInstr);

        if (_oOverlay && _oOverlay.parentNode) _oOverlay.parentNode.removeChild(_oOverlay);
    };

    // Auto-start
    this.start();
}
