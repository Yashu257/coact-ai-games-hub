(function () {
    function clamp(v, min, max) {
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }

    function dist(a, b) {
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function OneEuroFilter(freq, minCutoff, beta, dCutoff) {
        this.freq = freq || 60;
        this.minCutoff = minCutoff || 1.0;
        this.beta = beta || 0.0;
        this.dCutoff = dCutoff || 1.0;
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = null;
    }

    OneEuroFilter.prototype._alpha = function (cutoff, dt) {
        var r = 2 * Math.PI * cutoff * dt;
        return r / (r + 1);
    };

    OneEuroFilter.prototype.filter = function (x, tMs) {
        if (this.tPrev == null) {
            this.tPrev = tMs;
            this.xPrev = x;
            this.dxPrev = 0;
            return x;
        }

        var dt = Math.max((tMs - this.tPrev) / 1000, 1 / 240);
        this.tPrev = tMs;

        var dx = (x - this.xPrev) / dt;
        var aD = this._alpha(this.dCutoff, dt);
        var dxHat = aD * dx + (1 - aD) * this.dxPrev;
        this.dxPrev = dxHat;

        var cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
        var a = this._alpha(cutoff, dt);
        var xHat = a * x + (1 - a) * this.xPrev;
        this.xPrev = xHat;
        return xHat;
    };

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

    function GestureController(opts) {
        this._opts = Object.assign({
            canvas: null,
            handTracking: null,
            mirror: true,
            pinchThreshold: 0.045,
            pinchStableMs: 140,
            pinchMaxMovePx: 18,
            noHandTimeoutMs: 220,
            moveDispatchHz: 60,
            pointerMarginPx: 12
        }, opts || {});

        this._canvas = this._opts.canvas;
        this._handTracking = this._opts.handTracking;

        this._cursor = createEl("div", { className: "gesture-cursor gesture-cursor--disabled" });
        this._cursorDot = createEl("div", { className: "gesture-cursor-dot" });
        this._cursorRing = createEl("div", { className: "gesture-cursor-ring" });
        this._cursor.appendChild(this._cursorRing);
        this._cursor.appendChild(this._cursorDot);
        document.body.appendChild(this._cursor);

        this._debug = createEl("div", { className: "gesture-debug", text: "" });
        document.body.appendChild(this._debug);

        this._filterX = new OneEuroFilter(60, 1.2, 0.02, 1.0);
        this._filterY = new OneEuroFilter(60, 1.2, 0.02, 1.0);

        this._enabled = true;
        this._hasHand = false;
        this._isDown = false;
        this._pinchCandidate = null;
        this._lastMoveDispatchAt = 0;
        this._lastCursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this._drag = null;

        var self = this;
        this._unsub = this._handTracking.onFrame(function (frame) {
            self._onHandFrame(frame);
        });

        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState !== "visible") {
                self._forceRelease();
            }
        });

        window.addEventListener("blur", function () {
            self._forceRelease();
        });
    }

    GestureController.prototype.destroy = function () {
        if (this._unsub) this._unsub();
        this._unsub = null;
        this._forceRelease();
        if (this._cursor && this._cursor.parentNode) this._cursor.parentNode.removeChild(this._cursor);
        if (this._debug && this._debug.parentNode) this._debug.parentNode.removeChild(this._debug);
    };

    GestureController.prototype.setEnabled = function (v) {
        this._enabled = !!v;
        if (!this._enabled) this._forceRelease();
    };

    GestureController.prototype._setCursorState = function (state) {
        var cls = this._cursor.classList;
        cls.remove("gesture-cursor--disabled", "gesture-cursor--tracking", "gesture-cursor--pinch", "gesture-cursor--drag");
        if (state) cls.add(state);
    };

    GestureController.prototype._forceRelease = function () {
        if (this._isDown) {
            this._dispatchMouse("mouseup", this._lastCursor.x, this._lastCursor.y, 0);
        }
        this._isDown = false;
        this._pinchCandidate = null;
        this._drag = null;
        this._setCursorState(this._enabled ? "gesture-cursor--tracking" : "gesture-cursor--disabled");
    };

    GestureController.prototype._dispatchMouse = function (type, clientX, clientY, buttons) {
        if (!this._canvas) return;
        var init = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: clientX,
            clientY: clientY,
            button: 0,
            buttons: buttons || 0
        };

        var ev;

        try {
            ev = new MouseEvent(type, init);
            this._canvas.dispatchEvent(ev);
        } catch (e2) {
            ev = document.createEvent("MouseEvents");
            ev.initMouseEvent(type, true, true, window, 1, 0, 0, clientX, clientY, false, false, false, false, 0, null);
            this._canvas.dispatchEvent(ev);
        }
    };

    GestureController.prototype._toViewport = function (landmarks, mirror) {
        var p = landmarks[8];
        var xNorm = mirror ? (1 - p.x) : p.x;
        var yNorm = p.y;
        var rect = this._canvas.getBoundingClientRect();
        var margin = this._opts.pointerMarginPx;
        var x = rect.left + xNorm * rect.width;
        var y = rect.top + yNorm * rect.height;
        x = clamp(x, rect.left + margin, rect.right - margin);
        y = clamp(y, rect.top + margin, rect.bottom - margin);
        return { x: x, y: y, rect: rect };
    };

    GestureController.prototype._updateCursor = function (x, y, t) {
        var fx = this._filterX.filter(x, t);
        var fy = this._filterY.filter(y, t);
        this._lastCursor.x = fx;
        this._lastCursor.y = fy;
        this._cursor.style.transform = "translate(" + (fx - 10) + "px," + (fy - 10) + "px)";
    };

    GestureController.prototype._onHandFrame = function (frame) {
        var t = frame.t;
        var hasHand = !!frame.hasHand;
        var now = t;

        if (!this._enabled) {
            this._setCursorState("gesture-cursor--disabled");
            return;
        }

        if (!hasHand) {
            if (this._hasHand && (now - frame.lastHandSeenAt) > this._opts.noHandTimeoutMs) {
                this._hasHand = false;
                this._forceRelease();
            }
            this._setCursorState("gesture-cursor--disabled");
            this._debug.textContent = "hand: none";
            return;
        }

        this._hasHand = true;

        if (typeof this._handTracking.isRunning === "function" && !this._handTracking.isRunning()) {
            this._setCursorState("gesture-cursor--disabled");
            return;
        }

        var pt = this._toViewport(frame.landmarks, this._opts.mirror);
        this._updateCursor(pt.x, pt.y, t);

        var thumbTip = frame.landmarks[4];
        var indexTip = frame.landmarks[8];
        var pinch = dist(thumbTip, indexTip);
        var pinchRaw = pinch < this._opts.pinchThreshold;

        this._debug.textContent = "hand: ok | pinch: " + pinch.toFixed(3);

        this._setCursorState(this._isDown ? "gesture-cursor--drag" : "gesture-cursor--tracking");

        if (pinchRaw && !this._isDown) {
            if (!this._pinchCandidate) {
                this._pinchCandidate = {
                    startAt: now,
                    startPos: { x: this._lastCursor.x, y: this._lastCursor.y }
                };
                this._setCursorState("gesture-cursor--pinch");
            } else {
                var elapsed = now - this._pinchCandidate.startAt;
                var moved = Math.hypot(this._lastCursor.x - this._pinchCandidate.startPos.x, this._lastCursor.y - this._pinchCandidate.startPos.y);
                if (elapsed >= this._opts.pinchStableMs && moved <= this._opts.pinchMaxMovePx) {
                    this._isDown = true;
                    this._drag = {
                        startAt: now,
                        startPos: { x: this._lastCursor.x, y: this._lastCursor.y },
                        maxDist: 0
                    };
                    this._dispatchMouse("mousedown", this._lastCursor.x, this._lastCursor.y, 1);
                    this._setCursorState("gesture-cursor--drag");
                }
            }
        }

        if (!pinchRaw) {
            this._pinchCandidate = null;
            if (this._isDown) {
                this._dispatchMouse("mouseup", this._lastCursor.x, this._lastCursor.y, 0);
                if (this._drag) {
                    var heldMs = now - this._drag.startAt;
                    var shouldDrop = this._drag.maxDist >= 26 && heldMs >= 180;
                    if (shouldDrop) {
                        this._dispatchMouse("mousedown", this._lastCursor.x, this._lastCursor.y, 1);
                        this._dispatchMouse("mouseup", this._lastCursor.x, this._lastCursor.y, 0);
                    }
                }
                this._isDown = false;
                this._drag = null;
                this._setCursorState("gesture-cursor--tracking");
            }
        }

        if (this._isDown) {
            var minInterval = 1000 / this._opts.moveDispatchHz;
            if ((now - this._lastMoveDispatchAt) >= minInterval) {
                this._dispatchMouse("mousemove", this._lastCursor.x, this._lastCursor.y, 1);
                this._lastMoveDispatchAt = now;
            }
            if (this._drag) {
                var d = Math.hypot(this._lastCursor.x - this._drag.startPos.x, this._lastCursor.y - this._drag.startPos.y);
                if (d > this._drag.maxDist) this._drag.maxDist = d;
            }
        }
    };

    function initGestureChess() {
        var canvas = document.getElementById("canvas");
        if (!canvas) return null;
        if (typeof window.HandTracking === "undefined") return null;

        var handTracking = new window.HandTracking({
            attachTo: document.body,
            debug: true,
            mirror: true
        });

        var controller = new GestureController({
            canvas: canvas,
            handTracking: handTracking,
            mirror: handTracking.getMirror(),
            pinchThreshold: 0.045,
            pinchStableMs: 140,
            pinchMaxMovePx: 18,
            noHandTimeoutMs: 220
        });

        return { handTracking: handTracking, controller: controller };
    }

    window.GestureChess = {
        init: function () {
            if (window.__gestureChess) return window.__gestureChess;
            window.__gestureChess = initGestureChess();
            return window.__gestureChess;
        }
    };
})();
