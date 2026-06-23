/**
 * GesturePhysics.js
 * Converts a drag vector (start → end in canvas-logical coords) into
 * the _vHitDir values that CGame's existing physics engine expects.
 *
 * CGame's onPressUp logic:
 *   vHitDir.x  = -(clickX - releaseX) * distance * FORCE_RATE * FORCE_MULTIPLIER_AXIS.x   (~0.12)
 *   vHitDir.y  = iTimePressDown / 10   (clamped MIN_FORCE_Y=50..MAX_FORCE_Y=66)
 *   vHitDir.z  = (clickY - releaseY) * distance * FORCE_RATE * FORCE_MULTIPLIER_AXIS.z    (~0.08)
 *
 * We reproduce the same maths so the result is indistinguishable from
 * a real mouse swipe.
 */

var GesturePhysics = (function () {

    // Mirror of CGame constants (read from globals at call-time)
    var _FORCE_RATE          = typeof FORCE_RATE          !== 'undefined' ? FORCE_RATE          : 0.0014;
    var _FORCE_MAX           = typeof FORCE_MAX           !== 'undefined' ? FORCE_MAX           : 0.5;
    var _HIT_BALL_MIN_FORCE  = typeof HIT_BALL_MIN_FORCE  !== 'undefined' ? HIT_BALL_MIN_FORCE  : 5;
    var _HIT_BALL_MAX_FORCE  = typeof HIT_BALL_MAX_FORCE  !== 'undefined' ? HIT_BALL_MAX_FORCE  : 130;
    var _MIN_FORCE_Y         = typeof MIN_FORCE_Y         !== 'undefined' ? MIN_FORCE_Y         : 50;
    var _MAX_FORCE_Y         = typeof MAX_FORCE_Y         !== 'undefined' ? MAX_FORCE_Y         : 66;
    var _FX                  = typeof FORCE_MULTIPLIER_AXIS !== 'undefined' ? FORCE_MULTIPLIER_AXIS.x : 0.12;
    var _FZ                  = typeof FORCE_MULTIPLIER_AXIS !== 'undefined' ? FORCE_MULTIPLIER_AXIS.z : 0.08;

    /**
     * Build the EaselJS "fake press" coordinates from a gesture drag.
     *
     * @param {object} grabPt    {x, y}  canvas-logical grab point (mousedown)
     * @param {object} releasePt {x, y}  canvas-logical release point (mouseup)
     * @param {number} holdMs    milliseconds the gesture was held
     * @returns {object}  { clickPt, releasePt, holdMs }  ready for injection
     */
    function buildSwipeCoords(grabPt, releasePt, holdMs) {
        // Keep constants fresh from globals in case they were set after load
        _FORCE_RATE         = typeof FORCE_RATE          !== 'undefined' ? FORCE_RATE          : _FORCE_RATE;
        _HIT_BALL_MIN_FORCE = typeof HIT_BALL_MIN_FORCE  !== 'undefined' ? HIT_BALL_MIN_FORCE  : _HIT_BALL_MIN_FORCE;
        _HIT_BALL_MAX_FORCE = typeof HIT_BALL_MAX_FORCE  !== 'undefined' ? HIT_BALL_MAX_FORCE  : _HIT_BALL_MAX_FORCE;
        _MIN_FORCE_Y        = typeof MIN_FORCE_Y         !== 'undefined' ? MIN_FORCE_Y         : _MIN_FORCE_Y;
        _MAX_FORCE_Y        = typeof MAX_FORCE_Y         !== 'undefined' ? MAX_FORCE_Y         : _MAX_FORCE_Y;

        return {
            clickPt:    { x: grabPt.x,    y: grabPt.y    },
            releasePt:  { x: releasePt.x, y: releasePt.y },
            holdMs:     holdMs
        };
    }

    /**
     * Validate that the drag is large enough to be a real shot.
     * Mirrors CGame's internal guard: fForceLength > HIT_BALL_MIN_FORCE
     */
    function isValidDrag(grabPt, releasePt) {
        var dx  = grabPt.x - releasePt.x;
        var dy  = grabPt.y - releasePt.y;
        var dist = Math.sqrt(dx * dx + dy * dy) * _FORCE_RATE;
        var len  = Math.sqrt((dx * dist) * (dx * dist) + (dy * dist) * (dy * dist));

        // Must be dragging upward (releasePt.y < grabPt.y in canvas space)
        // and have enough force
        return (releasePt.y < grabPt.y) && (len > _HIT_BALL_MIN_FORCE);
    }

    /**
     * Estimate a synthetic holdMs so the y-force lands in a satisfying
     * range based on how fast / far the drag was.
     * Longer / faster drag → higher shot.
     */
    function estimateHoldMs(grabPt, releasePt, elapsedMs) {
        var dy     = grabPt.y - releasePt.y;                 // positive = upward
        var frac   = Math.min(1, Math.max(0, dy / 300));     // normalise to 0..1
        // Map to MIN_FORCE_Y .. MAX_FORCE_Y → *10 to get ms equivalent
        var forceY = _MIN_FORCE_Y + frac * (_MAX_FORCE_Y - _MIN_FORCE_Y);
        return forceY * 10;     // CGame: fForceY = _iTimePressDown / 10
    }

    return {
        buildSwipeCoords: buildSwipeCoords,
        isValidDrag:      isValidDrag,
        estimateHoldMs:   estimateHoldMs
    };
}());
