import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RotateCcw, X } from "lucide-react";

type PlayerStats = {
  score: number;
  slices?: number;
  maxCombo?: number;
  accuracy?: number;
  reaction?: number;
  survived?: number;
  goals?: number;
  lives?: number;
};

type Props = {
  stats: {
    title: string;
    subtitle?: string;
    p1: PlayerStats;
    p2: PlayerStats;
  };
  onRestart: () => void;
  onExit: () => void;
  open?: boolean;
};

export default function WinnerScoreboard({ stats, onRestart, onExit, open = true }: Props) {
  const { p1, p2 } = stats;
  const winner =
    p1.score > p2.score ? "PLAYER 1" :
    p2.score > p1.score ? "PLAYER 2" :
    "DRAW";

  const winnerGradient =
    winner === "PLAYER 1" ? "from-lime-500 to-green-600" :
    winner === "PLAYER 2" ? "from-orange-500 to-rose-600" :
    "from-slate-500 to-slate-700";

  const StatRow = ({ label, v1, v2, unit = "" }: { label: string; v1?: number; v2?: number; unit?: string }) => {
    if (v1 === undefined && v2 === undefined) return null;
    const p1w = (v1 ?? 0) > (v2 ?? 0);
    const p2w = (v2 ?? 0) > (v1 ?? 0);
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
        <div className={`text-right text-lg font-[900] tabular-nums ${p1w ? "text-lime-400" : "text-white/70"}`}>
          {v1 !== undefined ? `${v1}${unit}` : "—"}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</div>
        <div className={`text-left text-lg font-[900] tabular-nums ${p2w ? "text-orange-400" : "text-white/70"}`}>
          {v2 !== undefined ? `${v2}${unit}` : "—"}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.88, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-[min(92vw,520px)] overflow-hidden rounded-[28px] border border-white/10 bg-slate-900 shadow-2xl"
          >
            {/* Green glow top */}
            <div className="absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl opacity-30"
              style={{ background: "radial-gradient(50% 50% at 50% 50%, #84cc16 0%, #22c55e 60%, transparent 80%)" }} />

            <div className="relative p-8">
              {/* Trophy + winner */}
              <div className="mb-6 flex flex-col items-center text-center">
                <motion.div
                  initial={{ rotate: -12, scale: 0.7 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 220 }}
                  className={`mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${winnerGradient} shadow-2xl`}
                >
                  <Trophy className="h-10 w-10 text-white" />
                </motion.div>
                <div className="text-[10px] font-bold tracking-[0.25em] text-white/40">{stats.subtitle || "MATCH COMPLETE"}</div>
                <h2 className="mt-1 text-[28px] font-[900] tracking-tight text-white">
                  {winner === "DRAW" ? "IT'S A DRAW!" : `${winner} WINS!`}
                </h2>
                <p className="mt-1 text-[12px] text-white/50">{stats.title}</p>
              </div>

              {/* Score board */}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                {/* Player labels */}
                <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/10 pb-3">
                  <div className="text-right text-[11px] font-bold tracking-wider text-lime-400">PLAYER 1</div>
                  <div className="text-[10px] font-bold tracking-wider text-white/30">VS</div>
                  <div className="text-left text-[11px] font-bold tracking-wider text-orange-400">PLAYER 2</div>
                </div>

                {/* Main score */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
                  <div className="text-right text-[42px] font-[900] tabular-nums leading-none text-lime-400">{p1.score}</div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white/30">SCORE</div>
                  <div className="text-left text-[42px] font-[900] tabular-nums leading-none text-orange-400">{p2.score}</div>
                </div>

                <div className="my-2 border-t border-white/10" />

                <StatRow label="Slices" v1={p1.slices} v2={p2.slices} />
                <StatRow label="Max Combo" v1={p1.maxCombo} v2={p2.maxCombo} unit="x" />
                <StatRow label="Goals" v1={p1.goals} v2={p2.goals} />
                <StatRow label="Lives Left" v1={p1.lives} v2={p2.lives} />
                <StatRow label="Survived" v1={p1.survived} v2={p2.survived} unit="s" />
                <StatRow label="Avg Reaction" v1={p1.reaction} v2={p2.reaction} unit="ms" />
              </div>

              {/* Buttons */}
              <div className="mt-5 flex gap-3">
                <button
                  onClick={onExit}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 py-3.5 text-[13px] font-bold text-white transition hover:bg-white/10"
                >
                  <X className="h-4 w-4" /> Exit
                </button>
                <button
                  onClick={onRestart}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-500 to-green-600 py-3.5 text-[13px] font-bold text-white shadow-lg shadow-green-900/40 transition hover:from-lime-400 hover:to-green-500"
                >
                  <RotateCcw className="h-4 w-4" /> Play Again
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
