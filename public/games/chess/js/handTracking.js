(function () {
    function clamp01(v) {
        if (v < 0) return 0;
        if (v > 1) return 1;
        return v;
    }

    function nowMs() {
        return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    }

    function createEl(tag, attrs) {
        var el = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                if (k === "style") {
                    Object.assign(el.style, attrs[k]);
                } else if (k === "className") {
                    el.className = attrs[k];
                } else if (k === "text") {
                    el.textContent = attrs[k];
                } else {
                    el.setAttribute(k, attrs[k]);
                }
            });
        }
        return el;
    }

    var HAND_CONNECTIONS = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [5, 9], [9, 10], [10, 11], [11, 12],
        [9, 13], [13, 14], [14, 15], [15, 16],
        [13, 17], [17, 18], [18, 19], [19, 20],
        [0, 17]
    ];

    function drawLandmarks(ctx, landmarks, w, h) {
        ctx.save();
        ctx.clearRect(0, 0, w, h);

        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0, 255, 255, 0.85)";
        for (var i = 0; i < HAND_CONNECTIONS.length; i++) {
            var a = landmarks[HAND_CONNECTIONS[i][0]];
            var b = landmarks[HAND_CONNECTIONS[i][1]];
            ctx.beginPath();
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.stroke();
        }

        ctx.fillStyle = "rgba(255, 80, 80, 0.95)";
        for (var j = 0; j < landmarks.length; j++) {
            var p = landmarks[j];
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function HandTracking(options) {
        this._options = Object.assign({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6,
            debug: true,
            videoWidth: 640,
            videoHeight: 480,
            facingMode: "user",
            mirror: true,
            attachTo: document.body
        }, options || {});

        this._listeners = [];
        this._running = false;
        this._lastHandSeenAt = 0;

        this._root = createEl("div", { className: "hand-debug-root" });
        this._panel = createEl("div", { className: "hand-debug-panel" });
        this._status = createEl("div", { className: "hand-debug-status", text: "Hand control: not started" });
        this._metrics = createEl("div", { className: "hand-debug-metrics", text: "" });
        this._startBtn = createEl("button", { className: "hand-debug-start", type: "button" });
        this._startBtn.textContent = "Enable Hand Control";

        this._video = createEl("video", {
            className: "hand-debug-video",
            playsinline: "true",
            autoplay: "true",
            muted: "true"
        });

        this._overlay = createEl("canvas", { className: "hand-debug-canvas" });
        this._ctx = this._overlay.getContext("2d");

        this._panel.appendChild(this._status);
        this._panel.appendChild(this._metrics);
        this._panel.appendChild(this._startBtn);
        this._panel.appendChild(this._video);
        this._panel.appendChild(this._overlay);
        this._root.appendChild(this._panel);
        this._options.attachTo.appendChild(this._root);

        if (this._options.mirror) {
            this._video.style.transform = "scaleX(-1)";
            this._overlay.style.transform = "scaleX(-1)";
        }

        var self = this;
        this._startBtn.addEventListener("click", function () {
            self.start();
        });
    }

    HandTracking.prototype.onFrame = function (cb) {
        if (typeof cb === "function") {
            this._listeners.push(cb);
        }
        var self = this;
        return function () {
            self._listeners = self._listeners.filter(function (x) { return x !== cb; });
        };
    };

    HandTracking.prototype.getMirror = function () {
        return !!this._options.mirror;
    };

    HandTracking.prototype.isRunning = function () {
        return this._running;
    };

    HandTracking.prototype.start = async function () {
        if (this._running) return;
        if (typeof Hands === "undefined" || typeof Camera === "undefined") {
            this._status.textContent = "Hand control: MediaPipe scripts not loaded";
            return;
        }

        this._status.textContent = "Hand control: requesting camera permission...";
        try {
            this._stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: this._options.facingMode,
                    width: this._options.videoWidth,
                    height: this._options.videoHeight
                },
                audio: false
            });
        } catch (e) {
            this._status.textContent = "Hand control: camera permission denied";
            return;
        }

        this._video.srcObject = this._stream;
        try {
            await this._video.play();
        } catch (e2) {
        }

        var self = this;
        this._hands = new Hands({
            locateFile: function (file) {
                return "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" + file;
            }
        });
        this._hands.setOptions({
            maxNumHands: this._options.maxNumHands,
            modelComplexity: this._options.modelComplexity,
            minDetectionConfidence: this._options.minDetectionConfidence,
            minTrackingConfidence: this._options.minTrackingConfidence
        });
        this._hands.onResults(function (results) {
            self._handleResults(results);
        });

        this._overlay.width = this._options.videoWidth;
        this._overlay.height = this._options.videoHeight;

        this._camera = new Camera(this._video, {
            onFrame: async function () {
                if (!self._hands) return;
                await self._hands.send({ image: self._video });
            },
            width: this._options.videoWidth,
            height: this._options.videoHeight
        });

        this._running = true;
        this._startBtn.disabled = true;
        this._status.textContent = "Hand control: starting...";

        try {
            await this._camera.start();
            this._status.textContent = "Hand control: running";
        } catch (e3) {
            this._status.textContent = "Hand control: failed to start camera";
        }
    };

    HandTracking.prototype.stop = function () {
        this._running = false;
        this._startBtn.disabled = false;

        if (this._camera && this._camera.stop) {
            try { this._camera.stop(); } catch (e) { }
        }
        this._camera = null;

        if (this._hands && this._hands.close) {
            try { this._hands.close(); } catch (e2) { }
        }
        this._hands = null;

        if (this._video) {
            try { this._video.pause(); } catch (e3) { }
            this._video.srcObject = null;
        }

        if (this._stream) {
            try {
                this._stream.getTracks().forEach(function (t) { t.stop(); });
            } catch (e4) { }
        }
        this._stream = null;

        this._status.textContent = "Hand control: stopped";
        this._metrics.textContent = "";
        if (this._ctx) {
            this._ctx.clearRect(0, 0, this._overlay.width, this._overlay.height);
        }
    };

    HandTracking.prototype._emit = function (payload) {
        for (var i = 0; i < this._listeners.length; i++) {
            try { this._listeners[i](payload); } catch (e) { }
        }
    };

    HandTracking.prototype._handleResults = function (results) {
        var t = nowMs();
        var hands = results && results.multiHandLandmarks ? results.multiHandLandmarks : [];
        var handedness = results && results.multiHandedness ? results.multiHandedness : [];

        var hasHand = hands.length > 0 && hands[0] && hands[0].length === 21;
        if (hasHand) {
            this._lastHandSeenAt = t;
        }

        var score = null;
        var label = null;
        if (handedness && handedness[0] && handedness[0].score != null) {
            score = handedness[0].score;
            label = handedness[0].label;
        }

        if (this._options.debug) {
            if (hasHand) {
                drawLandmarks(this._ctx, hands[0], this._overlay.width, this._overlay.height);
            } else {
                this._ctx.clearRect(0, 0, this._overlay.width, this._overlay.height);
            }

            var statusText = this._running ? "Hand control: running" : "Hand control: not started";
            if (this._running && !hasHand) {
                statusText = "Hand control: no hand in frame";
            }
            this._status.textContent = statusText;

            if (hasHand) {
                var pThumb = hands[0][4];
                var pIndex = hands[0][8];
                var dx = (pThumb.x - pIndex.x);
                var dy = (pThumb.y - pIndex.y);
                var pinchDist = Math.sqrt(dx * dx + dy * dy);
                var info = "landmarks: 21";
                if (label) info += " | hand: " + label;
                if (score != null) info += " | score: " + score.toFixed(2);
                info += " | pinch: " + pinchDist.toFixed(3);
                this._metrics.textContent = info;
            } else {
                this._metrics.textContent = "landmarks: 0";
            }
        }

        var first = hasHand ? hands[0].map(function (p) {
            return { x: clamp01(p.x), y: clamp01(p.y), z: p.z };
        }) : null;

        this._emit({
            t: t,
            hasHand: hasHand,
            landmarks: first,
            handedness: { label: label, score: score },
            lastHandSeenAt: this._lastHandSeenAt
        });
    };

    window.HandTracking = HandTracking;
})();

