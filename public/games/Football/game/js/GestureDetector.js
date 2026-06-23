/**
 * GestureDetector.js
 * Pure gesture-classification logic.
 * Takes a MediaPipe Hands result (one hand's landmarks array) and
 * returns a gesture string or null.
 *
 * Landmark indices (MediaPipe 21-point hand model):
 *  0  = WRIST
 *  1‒4  = THUMB  (cmc → tip)
 *  5‒8  = INDEX  (mcp → tip)
 *  9‒12 = MIDDLE (mcp → tip)
 * 13‒16 = RING   (mcp → tip)
 * 17‒20 = PINKY  (mcp → tip)
 */

var GestureDetector = (function () {

    // ── Helpers ───────────────────────────────────────────────────────────

    /** Return true if a finger is extended (tip above pip in image-y). */
    function _isExtended(lm, tipIdx, pipIdx) {
        // In image coordinates y increases downward, so tip.y < pip.y means up
        return lm[tipIdx].y < lm[pipIdx].y;
    }

    /** Return true if a finger is curled (tip below mcp in image-y). */
    function _isCurled(lm, tipIdx, mcpIdx) {
        return lm[tipIdx].y > lm[mcpIdx].y;
    }

    /**
     * Classify one hand's 21 landmarks.
     * @param {Array} lm  Array of {x, y, z} normalised landmark objects.
     * @param {string} handedness  'Left' or 'Right' (as reported by MediaPipe –
     *                             note MediaPipe mirrors: 'Right' = user's right).
     * @returns {string|null}
     */
    function classify(lm, handedness) {
        if (!lm || lm.length < 21) { return null; }

        // ── Finger extension flags ────────────────────────────────────────
        var thumbExt  = lm[4].x < lm[3].x;   // thumb: tip left of knuckle (right hand)
                                               // Will be adjusted per handedness below
        var indexExt  = _isExtended(lm, 8, 6);
        var middleExt = _isExtended(lm, 12, 10);
        var ringExt   = _isExtended(lm, 16, 14);
        var pinkyExt  = _isExtended(lm, 20, 18);

        // Thumb extension check differs for left vs right hand
        if (handedness === 'Right') {
            thumbExt = lm[4].x < lm[3].x;   // tip to the left of knuckle
        } else {
            thumbExt = lm[4].x > lm[3].x;   // tip to the right of knuckle
        }

        // Curled checks for power fist
        var indexCurled  = _isCurled(lm, 8,  5);
        var middleCurled = _isCurled(lm, 12, 9);
        var ringCurled   = _isCurled(lm, 16, 13);
        var pinkyCurled  = _isCurled(lm, 20, 17);

        // ── Classify ─────────────────────────────────────────────────────

        // FIST – all fingers curled, thumb roughly alongside
        if (indexCurled && middleCurled && ringCurled && pinkyCurled && !thumbExt) {
            return 'fist';
        }

        // THUMBS UP – only thumb extended, all others curled
        if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
            // Extra check: thumb pointing upward
            if (lm[4].y < lm[3].y) {
                return 'thumbs_up';
            }
        }

        // OPEN PALM – all five extended
        if (thumbExt && indexExt && middleExt && ringExt && pinkyExt) {
            return 'open_palm';
        }

        // PEACE SIGN – index + middle extended, others curled
        if (!thumbExt && indexExt && middleExt && !ringExt && !pinkyExt) {
            return 'peace';
        }

        // POINT UP – only index extended, pointing upward
        if (!thumbExt && indexExt && !middleExt && !ringExt && !pinkyExt) {
            var tipY = lm[8].y;
            var mcpY = lm[5].y;
            if (tipY < mcpY) {
                // Determine left / right based on index tip vs wrist x
                var tipX  = lm[8].x;
                var wristX = lm[0].x;
                var mcpX   = lm[5].x;

                // Horizontal lean: compare tip x to MCP x
                var dX = tipX - wristX;
                var dY = mcpY - tipY;  // positive = upward

                if (dY > 0.05 && Math.abs(dX) < dY * 0.8) {
                    return 'point_up';          // mostly vertical → up
                } else if (dX > 0.05) {
                    return 'point_right';       // leaning right in image space
                } else if (dX < -0.05) {
                    return 'point_left';        // leaning left in image space
                }
            }
        }

        return null;
    }

    // ── Public API ────────────────────────────────────────────────────────
    return {
        classify: classify
    };
}());
