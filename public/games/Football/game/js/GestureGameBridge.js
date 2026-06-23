/**
 * GestureGameBridge.js
 * Thin initialiser – the swipe injection in GestureManager handles
 * everything directly via real MouseEvents on the canvas, so no
 * translation layer is needed here.
 *
 * Kept as a module so gestureConfig can be toggled without touching
 * index.html, and so future gesture-to-action mappings can be added.
 */

var GestureGameBridge = (function () {
    var _initialised = false;

    function init() {
        if (_initialised) { return; }
        _initialised = true;
        // GestureManager injects real MouseEvents directly into the canvas,
        // which EaselJS picks up through its normal event pipeline.
        // Nothing extra needed here.
        console.log('[GestureGameBridge] Ready – swipe injection active.');
    }

    function destroy() {
        _initialised = false;
    }

    return { init: init, destroy: destroy };
}());
