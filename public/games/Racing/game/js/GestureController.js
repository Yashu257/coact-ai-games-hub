/**
 * GestureController.js
 *
 * GESTURES:
 *   👍  Thumb only              → ACCELERATE
 *   👆  Thumb + Index           → STEER RIGHT + ACCELERATE
 *   🤟  Thumb + Index + Middle  → STEER LEFT  + ACCELERATE
 *   ✊  Fist                    → BRAKE (stop accelerate)
 *   (no hand)                   → release all
 */
var GestureController = (function () {

    var _listeners = {};
    function _emit(evt, data) {
        var list = _listeners[evt] || [];
        for (var i = 0; i < list.length; i++) list[i](data);
    }
    function on(evt, fn) {
        if (!_listeners[evt]) _listeners[evt] = [];
        _listeners[evt].push(fn);
    }

    var _wasLeft  = false;
    var _wasRight = false;
    var _wasAccel = false;
    var _wasBrake = false;

    function _pickGesture(L, R) {
        var h = null;
        if (R && R.gesture && R.gesture !== 'NONE') h = R;
        else if (L && L.gesture && L.gesture !== 'NONE') h = L;
        else if (R) h = R;
        else if (L) h = L;
        return h ? (h.gesture || 'NONE') : 'NONE';
    }

    function update(handData) {
        var L = handData.left;
        var R = handData.right;

        if (!L && !R) {
            if (_wasLeft)  { _wasLeft  = false; _emit('STEER_LEFT',  false); }
            if (_wasRight) { _wasRight = false; _emit('STEER_RIGHT', false); }
            if (_wasAccel) { _wasAccel = false; _emit('STOP_ACCELERATE', {}); }
            if (_wasBrake) { _wasBrake = false; _emit('STOP_BRAKE', {}); }
            _emit('HANDS_VISIBLE', false);
            return;
        }

        _emit('HANDS_VISIBLE', true);

        var gesture = _pickGesture(L, R);

        // Determine what should be active based on gesture
        //   STEER_LEFT  → left ON,  right OFF, accel ON,  brake OFF
        //   STEER_RIGHT → left OFF, right ON,  accel ON,  brake OFF
        //   ACCELERATE  → left OFF, right OFF, accel ON,  brake OFF
        //   BRAKE       → left OFF, right OFF, accel OFF, brake ON
        //   NONE        → left OFF, right OFF, accel OFF, brake OFF

        var wLeft  = (gesture === 'STEER_LEFT');
        var wRight = (gesture === 'STEER_RIGHT');
        var wAccel = (gesture === 'ACCELERATE' || gesture === 'STEER_LEFT' || gesture === 'STEER_RIGHT');
        var wBrake = (gesture === 'BRAKE');

        // Emit only on change
        if (wLeft  !== _wasLeft)  { _wasLeft  = wLeft;  _emit('STEER_LEFT',  wLeft);  }
        if (wRight !== _wasRight) { _wasRight = wRight; _emit('STEER_RIGHT', wRight); }
        if (wAccel !== _wasAccel) { _wasAccel = wAccel; _emit(wAccel ? 'ACCELERATE' : 'STOP_ACCELERATE', {}); }
        if (wBrake !== _wasBrake) { _wasBrake = wBrake; _emit(wBrake ? 'BRAKE' : 'STOP_BRAKE', {}); }

        // Visual
        var angle = wLeft ? -45 : wRight ? 45 : 0;
        _emit('WHEEL_DATA',    { angle: angle });
        _emit('GESTURE_LABEL', gesture);
    }

    return { update: update, on: on };
})();
