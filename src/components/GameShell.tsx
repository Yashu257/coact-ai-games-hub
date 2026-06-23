import { ReactNode, RefObject, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, Hand, AlertCircle } from "lucide-react";
import { TrackingState, PlayersHands } from "../hooks/useHandTracking";

type Props = {
  title: string;
  category: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  state: TrackingState;
  handsRef: { current: PlayersHands };
  onExit: () => void;
  onRestart: () => void;
  p1Score: number;
  p2Score: number;
  timer: number | null; // seconds remaining or null
  extraHUD?: ReactNode;
  children?: ReactNode;
};

export default function GameShell({
  title,
  category,
  videoRef,
  canvasRef,
  state,
  handsRef,
  onExit,
  onRestart,
  p1Score,
  p2Score,
  timer,
  extraHUD,
  children,
}: Props) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowExitConfirm((v) => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const p1Detected = !!handsRef.current.p1;
  const p2Detected = !!handsRef.current.p2;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900">
      {/* Hidden video element for MediaPipe */}
      <video
        ref={videoRef}
        className="pointer-events-none absolute opacity-0"
        playsInline
        muted
      />

      {/* Game canvas - full screen */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
      />

      {/* Semi-transparent overlay with split divider */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {/* Top bar */}
        <div className="flex items-start justify-between p-4 md:p-6">
          {/* P1 info */}
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/20 bg-slate-900/70 px-4 py-2.5 backdrop-blur-xl">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                p1Detected
                  ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)]"
                  : "bg-slate-700"
              }`}
            >
              <Hand className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-medium tracking-wide text-white/60">
                PLAYER 1
              </div>
              <div className="text-lg font-bold text-white">{p1Score}</div>
            </div>
          </div>

          {/* Center info */}
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-2xl border border-white/20 bg-slate-900/70 px-5 py-2 text-center backdrop-blur-xl">
              <div className="text-[11px] font-medium tracking-[0.14em] text-white/60">
                {category}
              </div>
              <div className="text-sm font-bold text-white">{title}</div>
            </div>
            {timer !== null && (
              <div className="rounded-full border border-white/20 bg-slate-900/70 px-4 py-1 text-sm font-bold text-white backdrop-blur-xl">
                ⏱ {formatTime(timer)}
              </div>
            )}
            {extraHUD}
          </div>

          {/* P2 info */}
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/20 bg-slate-900/70 px-4 py-2.5 backdrop-blur-xl">
            <div>
              <div className="text-right text-[11px] font-medium tracking-wide text-white/60">
                PLAYER 2
              </div>
              <div className="text-right text-lg font-bold text-white">{p2Score}</div>
            </div>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                p2Detected
                  ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)]"
                  : "bg-slate-700"
              }`}
            >
              <Hand className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="mt-auto flex items-end justify-between p-4 md:p-6">
          <button
            onClick={onRestart}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/70 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-xl transition hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
            Restart
          </button>
          <div className="pointer-events-auto text-xs text-white/50">
            {p1Detected ? "✓ P1 tracking" : "○ P1 not visible"} ·{" "}
            {p2Detected ? "✓ P2 tracking" : "○ P2 not visible"}
          </div>
          <button
            onClick={() => setShowExitConfirm(true)}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/70 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-xl transition hover:bg-red-600"
          >
            <X className="h-4 w-4" />
            Exit
          </button>
        </div>
      </div>

      {/* Loading / permission overlay */}
      <AnimatePresence>
        {state.status !== "ready" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950"
          >
            <div className="max-w-md rounded-3xl border border-white/10 bg-slate-900 p-10 text-center shadow-2xl">
              {state.status === "loading" && (
                <>
                  <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-indigo-500" />
                  <h3 className="text-xl font-semibold text-white">
                    Initializing AI Systems
                  </h3>
                  <p className="mt-2 text-sm text-white/60">
                    Loading hand tracking models...
                  </p>
                </>
              )}
              {state.status === "permission" && (
                <>
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20">
                    <Hand className="h-8 w-8 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    Camera Access Required
                  </h3>
                  <p className="mt-2 text-sm text-white/60">
                    Please allow camera access to enable hand tracking.
                  </p>
                </>
              )}
              {state.status === "error" && (
                <>
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                    <AlertCircle className="h-8 w-8 text-red-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    Camera Error
                  </h3>
                  <p className="mt-2 text-sm text-white/60">
                    {state.errorMsg || "Unable to access camera."}
                  </p>
                  <button
                    onClick={onExit}
                    className="mt-6 rounded-full bg-white/10 px-5 py-2 text-sm font-medium text-white hover:bg-white/20"
                  >
                    Back to Hub
                  </button>
                </>
              )}
              {state.status === "idle" && (
                <div className="text-white/60">Starting...</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit confirmation */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          >
            <div className="rounded-3xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl">
              <h3 className="text-xl font-semibold text-white">Exit game?</h3>
              <p className="mt-2 text-sm text-white/60">
                Your progress will be lost.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={onExit}
                  className="flex-1 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Exit
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </div>
  );
}
