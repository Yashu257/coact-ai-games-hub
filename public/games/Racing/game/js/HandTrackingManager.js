/**
 * HandTrackingManager.js
 * Uses @tensorflow-models/hand-pose-detection with MediaPipe runtime.
 * Dynamically loads scripts only when user enables gesture control.
 * Runs detection at low fps to avoid impacting game.
 */
var HandTrackingManager = (function () {

    var _listeners = {};
    function _emit(evt, data) {
        var list = _listeners[evt] || [];
        for (var i = 0; i < list.length; i++) list[i](data);
    }
    function on(evt, fn) {
        if (!_listeners[evt]) _listeners[evt] = [];
        _listeners[evt].push(fn);
    }

    var _detector = null;
    var _videoEl  = null;
    var _running  = false;
    var _busy     = false;

    // Landmark indices for hand-pose-detection
    var LM = {
        WRIST: 0,
        THUMB_CMC:1, THUMB_MCP:2, THUMB_IP:3, THUMB_TIP:4,
        INDEX_MCP:5, INDEX_PIP:6, INDEX_DIP:7, INDEX_TIP:8,
        MIDDLE_MCP:9, MIDDLE_PIP:10, MIDDLE_DIP:11, MIDDLE_TIP:12,
        RING_MCP:13, RING_PIP:14, RING_DIP:15, RING_TIP:16,
        PINKY_MCP:17, PINKY_PIP:18, PINKY_DIP:19, PINKY_TIP:20
    };

    function _dist3d(a, b) {
        var dx=a.x-b.x, dy=a.y-b.y, dz=(a.z||0)-(b.z||0);
        return Math.sqrt(dx*dx+dy*dy+dz*dz);
    }

    function _palmCenter(kps) {
        var pts = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP];
        var sx=0, sy=0;
        for (var i=0;i<pts.length;i++){sx+=kps[pts[i]].x;sy+=kps[pts[i]].y;}
        return { x: sx/(pts.length*640), y: sy/(pts.length*480) };
    }

    function _isExtended(kps, tipIdx, mcpIdx) {
        var wrist  = kps[LM.WRIST];
        var tip    = kps[tipIdx];
        var mcp    = kps[mcpIdx];
        var refSz  = _dist3d(wrist, kps[LM.MIDDLE_MCP]) || 1;
        // Lowered margin from 0.15 → 0.08 for more sensitive extension detection
        return _dist3d(wrist, tip) > (_dist3d(wrist, mcp) + refSz * 0.08);
    }

    function _isThumbExtended(kps) {
        var thumbTip  = kps[LM.THUMB_TIP];
        var indexMcp  = kps[LM.INDEX_MCP];
        var middleMcp = kps[LM.MIDDLE_MCP];
        var refSz     = _dist3d(kps[LM.WRIST], middleMcp) || 1;
        // Lowered threshold from 0.6 → 0.45 for easier thumb-up detection
        return _dist3d(thumbTip, indexMcp) > refSz * 0.45;
    }

    function _getGesture(kps) {
        var thumb  = _isThumbExtended(kps);
        var index  = _isExtended(kps, LM.INDEX_TIP,  LM.INDEX_MCP);
        var middle = _isExtended(kps, LM.MIDDLE_TIP, LM.MIDDLE_MCP);
        var ring   = _isExtended(kps, LM.RING_TIP,   LM.RING_MCP);
        var pinky  = _isExtended(kps, LM.PINKY_TIP,  LM.PINKY_MCP);

        console.log('[G]','T:'+thumb,'I:'+index,'M:'+middle,'R:'+ring,'P:'+pinky);

        // Fist — nothing extended
        if (!thumb && !index && !middle && !ring && !pinky) return 'BRAKE';
        // Thumb+Index+Middle → STEER LEFT
        if (thumb && index && middle) return 'STEER_LEFT';
        // Thumb+Index → STEER RIGHT
        if (thumb && index && !middle) return 'STEER_RIGHT';
        // Thumb only → ACCELERATE
        if (thumb && !index && !middle) return 'ACCELERATE';
        // All fingers open → NONE
        return 'NONE';
    }

    function _processHands(hands) {
        var leftHand=null, rightHand=null;
        if (!hands || hands.length===0) {
            _emit('hands', {left:null, right:null});
            return;
        }
        // Sort by x — lower x = user's right hand (mirror)
        var sorted = hands.slice().sort(function(a,b){
            return a.keypoints[0].x - b.keypoints[0].x;
        });
        function _makeHd(h) {
            var kps = h.keypoints;
            var g   = _getGesture(kps);
            return { palm:_palmCenter(kps), gesture:g, thumbUp:g==='ACCELERATE', fist:g==='BRAKE' };
        }
        if (sorted.length>=2) {
            rightHand = _makeHd(sorted[0]);
            leftHand  = _makeHd(sorted[1]);
        } else {
            var hd = _makeHd(sorted[0]);
            if (hd.palm.x < 0.5) rightHand = hd;
            else                   leftHand  = hd;
        }
        _emit('hands', {left:leftHand, right:rightHand});
    }

    function _loop() {
        if (!_running || _busy) { setTimeout(_loop, 50); return; }
        if (!_videoEl || _videoEl.readyState < 2) { setTimeout(_loop, 100); return; }
        _busy = true;
        _detector.estimateHands(_videoEl, {flipHorizontal: true})
            .then(function(hands) {
                _busy = false;
                _processHands(hands);
                setTimeout(_loop, 60); // ~16fps — better gesture response without lagging game
            })
            .catch(function(e) {
                _busy = false;
                console.warn('[HTM]', e.message);
                setTimeout(_loop, 200);
            });
    }

    function _loadScript(src) {
        return new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function init() {
        console.log('[HTM] Loading scripts...');

        // Load TF.js + hand-pose-detection + mediapipe solution files
        _loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@3.9.0/dist/tf-core.min.js')
        .then(function(){ return _loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@3.9.0/dist/tf-backend-webgl.min.js'); })
        .then(function(){ return _loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter@3.9.0/dist/tf-converter.min.js'); })
        .then(function(){ return _loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js'); })
        .then(function(){ return _loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/hand-pose-detection@2.0.0/dist/hand-pose-detection.min.js'); })
        .then(function() {
            console.log('[HTM] Scripts loaded. Starting webcam...');
            // Setup video
            _videoEl = document.createElement('video');
            _videoEl.setAttribute('autoplay','');
            _videoEl.setAttribute('playsinline','');
            _videoEl.muted = true;
            _videoEl.width  = 640;
            _videoEl.height = 480;
            _videoEl.style.cssText='position:fixed;top:-9999px;left:-9999px;';
            document.body.appendChild(_videoEl);

            return navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});
        })
        .then(function(stream) {
            _videoEl.srcObject = stream;
            return _videoEl.play();
        })
        .then(function() {
            console.log('[HTM] Webcam active. Creating detector...');
            var model = handPoseDetection.SupportedModels.MediaPipeHands;
            return handPoseDetection.createDetector(model, {
                runtime: 'mediapipe',
                solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915',
                modelType: 'lite',
                maxHands: 2
            });
        })
        .then(function(detector) {
            _detector = detector;
            _running  = true;
            console.log('[HTM] ✅ Hand detection ready!');
            _loop();
        })
        .catch(function(err) {
            console.warn('[HTM] Failed:', err.message);
            _emit('disabled', {});
        });
    }

    return { init:init, on:on };
})();
