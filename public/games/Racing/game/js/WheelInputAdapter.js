/**
 * WheelInputAdapter.js
 * Maps GestureController events → s_oGame.onKeyDown / onKeyUp.
 * Does NOT touch any game code. Keyboard still works in parallel.
 */
var WheelInputAdapter = (function () {

    var _attached = false;
    var _h = { left: false, right: false, accel: false, brake: false };

    function _press(k)   { if (typeof s_oGame !== 'undefined' && s_oGame) s_oGame.onKeyDown(k); }
    function _release(k) { if (typeof s_oGame !== 'undefined' && s_oGame) s_oGame.onKeyUp(k); }

    function attach(gc) {
        if (_attached) return;
        _attached = true;

        gc.on('STEER_LEFT', function(on) {
            if (on && !_h.left) {
                if (_h.right) { _h.right = false; _release(KEY_RIGHT); }
                _h.left = true; _press(KEY_LEFT);
            } else if (!on && _h.left) {
                _h.left = false; _release(KEY_LEFT);
            }
        });

        gc.on('STEER_RIGHT', function(on) {
            if (on && !_h.right) {
                if (_h.left) { _h.left = false; _release(KEY_LEFT); }
                _h.right = true; _press(KEY_RIGHT);
            } else if (!on && _h.right) {
                _h.right = false; _release(KEY_RIGHT);
            }
        });

        gc.on('ACCELERATE',      function() { if (!_h.accel) { if (_h.brake) { _h.brake=false; _release(KEY_DOWN); } _h.accel=true; _press(KEY_UP); } });
        gc.on('STOP_ACCELERATE', function() { if (_h.accel)  { _h.accel=false; _release(KEY_UP); } });
        gc.on('BRAKE',           function() { if (!_h.brake) { if (_h.accel) { _h.accel=false; _release(KEY_UP); } _h.brake=true; _press(KEY_DOWN); } });
        gc.on('STOP_BRAKE',      function() { if (_h.brake)  { _h.brake=false; _release(KEY_DOWN); } });
        gc.on('NITRO',           function() { if (!_h.accel) { _h.accel=true; _press(KEY_UP); } });
    }

    function releaseAll() {
        if (_h.left)  _release(KEY_LEFT);
        if (_h.right) _release(KEY_RIGHT);
        if (_h.accel) _release(KEY_UP);
        if (_h.brake) _release(KEY_DOWN);
        _h = { left:false, right:false, accel:false, brake:false };
    }

    return { attach: attach, releaseAll: releaseAll };
})();
