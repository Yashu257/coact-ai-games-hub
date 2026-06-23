/**
 * gestureConfig.js
 * Configuration for the webcam gesture control system.
 * Modify these values to tune gesture detection behaviour.
 */
var GESTURE_CONFIG = {
    // Master switch – set to false to disable all gesture detection
    enabled: true,

    // Milliseconds between repeated triggers of the same gesture
    cooldown: 500,

    // Minimum MediaPipe confidence score (0‒1) to accept a hand detection
    confidence: 0.75,

    // Draw hand landmark skeleton on the webcam overlay canvas
    showLandmarks: true,

    // Show gesture name / status text in the corner
    showStatus: true,

    // Target camera width / height for the hidden video element
    cameraWidth: 640,
    cameraHeight: 480,

    // Smoothing: number of frames to average landmark positions over
    smoothingFrames: 3,

    // Minimum frames a gesture must be held before firing (reduces jitter)
    minHoldFrames: 2,

    // Synthesised swipe magnitudes fed into the game physics
    // Tune these to change how hard / where gesture shots go
    gestureForce: {
        left:  { x:  60, y: 56, z: 5  },   // aim left
        right: { x: -60, y: 56, z: 5  },   // aim right
        up:    { x:   0, y: 66, z: 9  },   // high shot
        shoot: { x:   0, y: 58, z: 6  },   // straight centre shot
        curve: { x: -40, y: 58, z: 7  }    // curve right
    }
};
