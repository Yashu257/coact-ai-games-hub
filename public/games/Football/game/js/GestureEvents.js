/**
 * GestureEvents.js
 * Central event bus for the gesture system.
 * Uses a plain DOM CustomEvent / EventTarget so it is completely
 * independent of the EaselJS / jQuery event systems used by the game.
 *
 * Usage (emit):
 *   GestureEvents.emit(GestureEvents.GESTURE_LEFT);
 *
 * Usage (subscribe):
 *   GestureEvents.on(GestureEvents.GESTURE_SHOOT, function(e) { ... });
 *
 * Usage (unsubscribe):
 *   GestureEvents.off(GestureEvents.GESTURE_SHOOT, handler);
 */

var GestureEvents = (function () {
    // ── Event name constants ──────────────────────────────────────────────
    var GESTURE_LEFT   = 'GESTURE_LEFT';
    var GESTURE_RIGHT  = 'GESTURE_RIGHT';
    var GESTURE_UP     = 'GESTURE_UP';
    var GESTURE_SHOOT  = 'GESTURE_SHOOT';
    var GESTURE_POWER  = 'GESTURE_POWER';
    var GESTURE_RESET  = 'GESTURE_RESET';
    var GESTURE_CURVE  = 'GESTURE_CURVE';
    var GESTURE_PAUSE  = 'GESTURE_PAUSE';

    // ── Internal EventTarget bus ──────────────────────────────────────────
    // Use a plain object as target so we work in all browsers without
    // needing a real DOM node.
    var _bus = document.createDocumentFragment();

    function on(eventName, handler) {
        _bus.addEventListener(eventName, handler);
    }

    function off(eventName, handler) {
        _bus.removeEventListener(eventName, handler);
    }

    function emit(eventName, detail) {
        var evt;
        try {
            evt = new CustomEvent(eventName, { detail: detail || null });
        } catch (e) {
            // IE11 fallback
            evt = document.createEvent('CustomEvent');
            evt.initCustomEvent(eventName, true, true, detail || null);
        }
        _bus.dispatchEvent(evt);
    }

    // ── Public API ────────────────────────────────────────────────────────
    return {
        // Constants
        GESTURE_LEFT:  GESTURE_LEFT,
        GESTURE_RIGHT: GESTURE_RIGHT,
        GESTURE_UP:    GESTURE_UP,
        GESTURE_SHOOT: GESTURE_SHOOT,
        GESTURE_POWER: GESTURE_POWER,
        GESTURE_RESET: GESTURE_RESET,
        GESTURE_CURVE: GESTURE_CURVE,
        GESTURE_PAUSE: GESTURE_PAUSE,

        on:   on,
        off:  off,
        emit: emit
    };
}());
