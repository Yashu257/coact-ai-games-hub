import { useEffect, useRef, useState, RefObject } from "react";

export type Landmark = { x: number; y: number; z: number };
export type HandData = {
  landmarks: Landmark[];
  handedness: "Left" | "Right";
  centerX: number;
  centerY: number;
};

export type TrackingState = {
  status: "idle" | "loading" | "permission" | "ready" | "error";
  errorMsg?: string;
};

export type PlayersHands = {
  p1: HandData | null; // left half of frame
  p2: HandData | null; // right half of frame
};

// Finger tip indices in MediaPipe landmarks
export const WRIST = 0;
export const THUMB_TIP = 4;
export const INDEX_TIP = 8;
export const MIDDLE_TIP = 12;
export const RING_TIP = 16;
export const PINKY_TIP = 20;
export const INDEX_MCP = 5;
export const MIDDLE_MCP = 9;
export const RING_MCP = 13;
export const PINKY_MCP = 17;
export const THUMB_MCP = 2;

const dist = (a: Landmark, b: Landmark) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export function isFist(lm: Landmark[]): boolean {
  const wrist = lm[WRIST];
  const tips = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP].map(
    (i) => lm[i]
  );
  const palmCenter = lm[INDEX_MCP];
  const avgTipDist = tips.reduce((s, t) => s + dist(t, palmCenter), 0) / tips.length;
  const ref = dist(wrist, palmCenter);
  return avgTipDist < ref * 1.05;
}

export function isOpenPalm(lm: Landmark[]): boolean {
  const wrist = lm[WRIST];
  const tips = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP].map((i) => lm[i]);
  const palmCenter = lm[INDEX_MCP];
  const avgTipDist = tips.reduce((s, t) => s + dist(t, palmCenter), 0) / tips.length;
  const ref = dist(wrist, palmCenter);
  return avgTipDist > ref * 1.6;
}

export function isPointing(lm: Landmark[]): boolean {
  const palmCenter = lm[INDEX_MCP];
  const wrist = lm[WRIST];
  const indexTip = lm[INDEX_TIP];
  const otherTips = [MIDDLE_TIP, RING_TIP, PINKY_TIP].map((i) => lm[i]);
  const indexExtended = dist(indexTip, palmCenter) > dist(wrist, palmCenter) * 1.4;
  const othersCurled = otherTips.every(
    (t) => dist(t, palmCenter) < dist(wrist, palmCenter) * 1.1
  );
  return indexExtended && othersCurled;
}

export function isKickGesture(lm: Landmark[]): boolean {
  // quick upward motion = kick (detected elsewhere via velocity)
  // here just check: open hand low
  return isOpenPalm(lm) && lm[WRIST].y > 0.6;
}

export function useHandTracking(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean
) {
  const [state, setState] = useState<TrackingState>({ status: "idle" });
  const handsRef = useRef<PlayersHands>({ p1: null, p2: null });
  const prevPosRef = useRef<{ p1: { x: number; y: number; t: number } | null; p2: { x: number; y: number; t: number } | null }>({ p1: null, p2: null });
  const velocityRef = useRef<{ p1: number; p2: number }>({ p1: 0, p2: 0 });
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled || !videoRef.current) return;
    let cancelled = false;
    let handsInstance: any = null;
    let stream: MediaStream | null = null;

    setState({ status: "loading" });

    const start = async () => {
      try {
        // @ts-ignore
        const { Hands } = await import("@mediapipe/hands");
        handsInstance = new Hands({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        handsInstance.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5,
        });
        handsInstance.onResults((results: any) => {
          if (cancelled) return;
          const multiHandLandmarks: Landmark[][] =
            results.multiHandLandmarks || [];
          const multiHandedness: any[] = results.multiHandedness || [];
          let p1: HandData | null = null;
          let p2: HandData | null = null;
          multiHandLandmarks.forEach((lm, i) => {
            const cx =
              lm.reduce((s, p) => s + p.x, 0) / lm.length;
            const cy =
              lm.reduce((s, p) => s + p.y, 0) / lm.length;
            // Note: MediaPipe gives mirrored labels. In mirrored video,
            // "Left" hand label means right side of scene.
            const label = multiHandedness[i]?.label as
              | "Left"
              | "Right"
              | undefined;
            const data: HandData = {
              landmarks: lm,
              handedness: label === "Left" ? "Right" : "Left",
              centerX: cx,
              centerY: cy,
            };
            if (cx < 0.5) {
              if (!p1 || cx > p1.centerX) p1 = data;
            } else {
              if (!p2 || cx < p2.centerX) p2 = data;
            }
          });
          // compute velocity for swipe detection
          const now = performance.now();
          const computeVelocity = (
            key: "p1" | "p2",
            hand: HandData | null
          ) => {
            const prev = prevPosRef.current[key];
            if (hand && prev) {
              const dt = Math.max(now - prev.t, 1);
              const dx = hand.centerX - prev.x;
              const dy = hand.centerY - prev.y;
              const v = Math.hypot(dx, dy) / (dt / 1000);
              velocityRef.current[key] = v;
            }
            if (hand) {
              prevPosRef.current[key] = {
                x: hand.centerX,
                y: hand.centerY,
                t: now,
              };
            } else {
              prevPosRef.current[key] = null;
              velocityRef.current[key] = 0;
            }
          };
          computeVelocity("p1", p1);
          computeVelocity("p2", p2);

          handsRef.current = { p1, p2 };
        });

        setState({ status: "permission" });
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        setState({ status: "ready" });

        let rafId = 0;
        const loop = async () => {
          if (cancelled) return;
          if (video.readyState >= 2) {
            try {
              await handsInstance.send({ image: video });
            } catch {
              // ignore transient errors
            }
          }
          rafId = requestAnimationFrame(loop);
        };
        loop();
        stopRef.current = () => {
          cancelled = true;
          cancelAnimationFrame(rafId);
          if (stream) stream.getTracks().forEach((t) => t.stop());
        };
      } catch (e: any) {
        if (!cancelled) {
          setState({
            status: "error",
            errorMsg: e?.message || "Failed to start camera",
          });
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      stopRef.current();
    };
  }, [enabled, videoRef]);

  return {
    state,
    handsRef,
    velocityRef,
  };
}
