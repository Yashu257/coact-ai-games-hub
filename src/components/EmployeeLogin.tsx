import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, User, Zap, Globe, Brain, Trophy } from "lucide-react";

const coactLogo = new URL('../assests/New AI logo/AI logo-04.png', import.meta.url).href;

type Props = { onComplete: (name: string) => void }

function CoactLogoFull() {
  return (
    <img 
      src={coactLogo} 
      alt="COACT.AI" 
      className="h-36 w-auto md:h-44 object-contain" 
      style={{ imageRendering: 'auto' }} 
      loading="eager" 
    />
  );
}

export default function EmployeeLogin({ onComplete }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) { setError("Please enter your full name (at least 2 characters)"); return; }
    if (trimmed.length > 40) { setError("Name must be 40 characters or less"); return; }
    onComplete(trimmed);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="grid w-full max-w-5xl items-center gap-14 lg:grid-cols-2">

          {/* Left — Branding */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-10">
              <CoactLogoFull />
            </div>

            <h1 className="text-[52px] font-[900] leading-[0.93] tracking-[-0.05em] text-slate-900 md:text-[68px]">
              <span className="bg-gradient-to-b from-[#4ade80] via-[#22c55e] to-[#16a34a] bg-clip-text text-transparent">AI GAMES</span>
              <br />
              <span className="text-slate-900">HUB</span>
            </h1>
            <p className="mt-5 max-w-md text-[16px] font-medium leading-[1.7] text-slate-500">
              Play intelligent COACT-powered games using real-time AI and hand tracking. Compete with colleagues, earn your score, and experience the future.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { icon: <Zap className="h-4 w-4" />, label: "10 AI Games", color: "bg-lime-100 text-lime-700" },
                { icon: <Globe className="h-4 w-4" />, label: "Multiplayer", color: "bg-green-100 text-green-700" },
                { icon: <Brain className="h-4 w-4" />, label: "Hand Tracking", color: "bg-emerald-100 text-emerald-700" },
                { icon: <Trophy className="h-4 w-4" />, label: "Leaderboards", color: "bg-teal-100 text-teal-700" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.color}`}>
                    {item.icon}
                  </div>
                  <span className="text-[13px] font-semibold text-slate-700">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — Login Card */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.75, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative mx-auto w-full max-w-md">
              {/* subtle glow */}
              <div className="absolute -inset-1 rounded-[32px] opacity-30 blur-2xl"
                style={{ background: "linear-gradient(135deg, #a3e635, #22c55e)" }} />

              <div className="relative rounded-[28px] border border-slate-200 bg-white p-8 shadow-xl md:p-10">
                {/* avatar icon */}
                <div className="mb-7 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-500 to-green-600 shadow-lg shadow-green-200">
                    <User className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="text-[26px] font-[800] tracking-[-0.03em] text-slate-900">Enter the Hub</h2>
                  <p className="mt-1.5 text-[13.5px] text-slate-500">Enter your name to start playing and tracking scores</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-[12px] font-bold tracking-[0.14em] text-slate-600">
                      YOUR NAME
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setError(""); }}
                      placeholder="e.g. Alex Johnson"
                      autoFocus
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-[16px] text-slate-900 outline-none transition focus:border-lime-400 focus:bg-white focus:ring-4 focus:ring-lime-100"
                    />
                    {error && <p className="mt-2 text-[12px] font-semibold text-rose-600">{error}</p>}
                  </div>

                  <button
                    type="submit"
                    className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-slate-900 px-6 py-4 text-[15px] font-bold text-white shadow-lg transition-all hover:bg-slate-800 active:scale-[0.98]"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Enter into Game Zone
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-lime-600 to-green-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </button>
                </form>

                <div className="mt-6 flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50 px-4 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-500 to-green-600 shadow">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-[12px] leading-relaxed text-slate-600">
                    Your scores are saved locally and tracked across all game sessions automatically.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
