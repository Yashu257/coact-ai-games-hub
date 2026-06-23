import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  User, Brain, Play, X,
  Eye, CircleDot,
  Trophy, Users, LogOut, ArrowRight,
  Car, Gamepad2, Target,
} from "lucide-react";
import PaddleBattleGame from "./games/PaddleBattle";
import EmployeeLogin from "./components/EmployeeLogin";
import Leaderboard from "./components/Leaderboard";
import {
  getCurrentEmployee,
  setCurrentEmployee,
  clearCurrentEmployee,
  removeGameFromAllEmployees,
} from "./utils/scoreStorage";

// ─── Types ────────────────────────────────────────────────────────────────────
type GameMode = "single" | "multi";
type Game = {
  id: string; title: string; category: string; description: string;
  features: string[]; image: string; icon: React.ReactNode;
  accent: string; accentHex: string; route?: string; mode: GameMode; imageFit?: "cover" | "contain";
};

function cn(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

// COACT.AI brand logos (full lockups)
const coactLogoLight = new URL('./assests/New AI logo/AI logo-01.png', import.meta.url).href;
const coactLogo04 = new URL('./assests/New AI logo/AI logo-04.png', import.meta.url).href;
const landingPageBg = new URL('./assests/Landing page bg.png', import.meta.url).href;

// ─── COACT.AI SVG Logo ────────────────────────────────────────────────────────
function CoactIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="44" stroke="url(#cg1)" strokeWidth="5.5" strokeDasharray="58 22" strokeLinecap="round" />
      <circle cx="50" cy="50" r="33" stroke="url(#cg1)" strokeWidth="4.5" strokeDasharray="42 18" strokeLinecap="round" />
      <circle cx="50" cy="50" r="22" stroke="url(#cg2)" strokeWidth="3.5" strokeDasharray="28 14" strokeLinecap="round" />
      <path d="M43 37 L43 63 L66 50 Z" fill="url(#cg1)" />
      <defs>
        <linearGradient id="cg1" x1="5" y1="5" x2="95" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#bef264" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id="cg2" x1="5" y1="5" x2="95" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Game Data ────────────────────────────────────────────────────────────────
const games: Game[] = [
  { id: "chess",    title: "Chess AI",     category: "AI Strategy",          description: "Challenge an intelligent AI opponent and improve your strategy with adaptive difficulty.", features: ["Adaptive AI", "Smart difficulty", "Real-time gameplay"], image: "/images/chess-ai.jpg",        icon: <Brain className="w-4 h-4" />,      accent: "from-violet-500 to-purple-700", accentHex: "#8b5cf6", route: "/games/chess", mode: "single" },
  { id: "face-puzzle", title: "Face Puzzle",     category: "Vision Puzzle",        description: "Solve a face puzzle with mouse or hand gestures. Shuffle, hint, and beat your best time.", features: ["Gesture support", "Difficulty levels", "Leaderboard"],     image: "/images/face%20puzzle.png", icon: <Eye className="w-4 h-4" />,        accent: "from-cyan-500 to-blue-600",     accentHex: "#06b6d4", route: "/games/face-puzzle", mode: "single", imageFit: "contain" },
  { id: "paddle-battle",  title: "AI Paddle Battle",     category: "Computer Vision",         description: "Classic Pong reimagined — control your paddle with hand movement up/down.",        features: ["Ball physics", "Real-time scoring", "2-player"],     image: "/images/paddle%20game.png",         icon: <CircleDot className="w-4 h-4" />,  accent: "from-blue-500 to-indigo-600",   accentHex: "#3b82f6", route: "/games/paddle-battle",  mode: "multi" },
  { id: "racing",         title: "AI Car Racing",        category: "Racing AI",               description: "Steer your car with hand gestures and race against AI opponents at full speed.",     features: ["Hand steering", "AI opponents", "Turbo boost"],        image: "/images/racing.png",             icon: <Car className="w-4 h-4" />,        accent: "from-red-500 to-orange-600",    accentHex: "#ef4444", route: "/games/racing",         mode: "single" },
  { id: "football",       title: "AI Football",          category: "Sports AI",               description: "Use hand gestures to control your player and score goals against the AI keeper.",   features: ["Gesture control", "AI goalkeeper", "Score tracking"],  image: "/images/Football.png",           icon: <Target className="w-4 h-4" />,     accent: "from-green-500 to-emerald-600", accentHex: "#22c55e", route: "/games/football",       mode: "single" },
  { id: "frog",           title: "Frog Jump",            category: "Arcade AI",               description: "Guide your frog across busy roads and rivers using hand gestures to survive.",      features: ["Hand gestures", "Obstacle dodging", "Level scaling"],  image: "/images/Frog.png",               icon: <Gamepad2 className="w-4 h-4" />,   accent: "from-lime-500 to-green-600",    accentHex: "#84cc16", route: "/games/frog",           mode: "single", imageFit: "contain" },
];

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [employee, setEmployee]   = useState<string | null>(() => getCurrentEmployee());
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [loadingGame, setLoadingGame] = useState<Game | null>(null);
  const [filterMode, setFilterMode]   = useState<"all" | GameMode>("all");
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setPathname(to);
  };

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    [
      "balloon-battle",
      "reaction-race",
      "vision",
      "creative",
      "quiz",
      "hand-battle",
      "fruit-battle",
      "gesture-soccer",
    ].forEach((id) =>
      removeGameFromAllEmployees(id),
    );
  }, []);

  useEffect(() => {
    const routed = games.find((g) => g.route === pathname);
    if (routed) {
      setActiveGame(routed);
      return;
    }
    setActiveGame((prev) => (prev?.route ? null : prev));
  }, [pathname]);

  const handlePlay = (game: Game) => {
    setLoadingGame(game); setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setActiveGame(game);
      setLoadingGame(null);
      if (game.route) navigate(game.route);
    }, 2000);
  };
  const exitGame = () => {
    setActiveGame(null);
    setLeaderboardRefreshKey(prev => prev + 1);
    navigate("/");
  };

  if (!employee) return <EmployeeLogin onComplete={async (name) => { await setCurrentEmployee(name); setEmployee(name); }} />;

  const filtered = games.filter((g) => filterMode === "all" || g.mode === filterMode);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white">

      {/* Navbar */}
      <Navbar employee={employee} onLogout={() => { clearCurrentEmployee(); setEmployee(null); }} />

      <main>
        {/* Hero */}
        <HeroSection onExplore={() => document.getElementById("games-section")?.scrollIntoView({ behavior: "smooth" })} />

        {/* Games Section */}
        <section id="games-section" className="mx-auto max-w-[1320px] px-6 pb-24 pt-16">
          {/* Section header */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }}
            className="mb-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.14em] text-green-700 shadow-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-500" />
                AI GAME COLLECTION
              </div>
              <h2 className="text-[34px] font-[900] tracking-[-0.03em] leading-none text-slate-900 md:text-[44px]">
                CHOOSE YOUR EXPERIENCE
              </h2>
            </div>
            <FilterTabs filterMode={filterMode} setFilterMode={setFilterMode} />
          </motion.div>

          {/* Cards grid — 4 per row on xl, 3 on lg, 2 on md, 1 on sm */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} onPlay={() => handlePlay(game)} />
            ))}
          </div>
        </section>

        {/* Leaderboard Section */}
        <section id="leaderboard" className="mx-auto max-w-[1320px] px-6 pb-24">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }} className="mb-10">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.14em] text-green-700 shadow-sm">
              <Trophy className="h-3 w-3" /> RANKINGS
            </div>
            <h2 className="text-[34px] font-[900] tracking-[-0.03em] leading-none text-slate-900 md:text-[44px]">LEADERBOARD</h2>
            <p className="mt-3 max-w-lg text-[15px] text-slate-500">Track your performance. Compete with colleagues and climb to the top.</p>
          </motion.div>
          <Leaderboard currentEmployee={employee} refreshKey={leaderboardRefreshKey} />
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-black">
          <div className="mx-auto max-w-[1320px] px-6 py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex items-center gap-2.5">
                <img 
                  src={coactLogoLight} 
                  alt="COACT.AI" 
                  className="h-20 w-auto md:h-24 object-contain" 
                  style={{ imageRendering: 'auto' }} 
                  loading="lazy" 
                />
              </div>
              <p className="text-sm text-white/50">— Artificial Intelligence —</p>
              <p className="max-w-md text-[13px] text-white/40">An AI-powered gaming platform built by COACT — where humans and machines play together.</p>
            </div>
          </div>
        </footer>
      </main>

      {/* Game Modal */}
      <AnimatePresence>
        {activeGame && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100]">
            {activeGame.id === "chess" ? (
              <EmbeddedHtmlGame title="AI Chess Arena" src="/games/chess/index.html" onExit={exitGame} />
            ) : activeGame.id === "face-puzzle" ? (
              <EmbeddedHtmlGame title="Face Puzzle" src="/games/Face%20Puzzle/index.html" onExit={exitGame} />
            ) : activeGame.id === "racing" ? (
              <EmbeddedHtmlGame title="AI Car Racing" src="/games/Racing/game/index.html" onExit={exitGame} />
            ) : activeGame.id === "football" ? (
              <EmbeddedHtmlGame title="AI Football" src="/games/Football/game/index.html" onExit={exitGame} />
            ) : activeGame.id === "frog" ? (
              <EmbeddedHtmlGame title="Frog Jump" src="/games/Frog/game/index.html" onExit={exitGame} />
            )
            : activeGame.id === "paddle-battle"  ? <PaddleBattleGame  employeeName={employee} onExit={exitGame} />
            : <GameInfoPage game={activeGame} onClose={exitGame} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Screen */}
      <AnimatePresence>
        {isLoading && loadingGame && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8" style={{ background: "#f2fbf4" }}>
            <div className="pointer-events-none absolute inset-0">
              <svg className="h-full w-full opacity-[0.3]">
                <rect width="100%" height="100%" fill="url(#dotgrid)" />
              </svg>
            </div>
            <div className="relative flex flex-col items-center gap-6">
              <div className="flex items-center gap-3">
                <img 
                  src={coactLogo04} 
                  alt="COACT.AI" 
                  className="h-24 w-auto object-contain" 
                  style={{ imageRendering: 'auto' }}
                />
                <div>
                  <div className="text-[10px] font-bold tracking-[0.2em] text-lime-600">LAUNCHING</div>
                  <div className="text-[22px] font-[900] tracking-tight text-slate-900">{loadingGame.title}</div>
                </div>
              </div>
              <LoadingDots />
              <p className="text-sm text-slate-500">Initializing AI systems...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmbeddedHtmlGame({ title, src, onExit }: { title: string; src: string; onExit: () => void }) {
  return (
    <div className="flex h-full w-full flex-col bg-black">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-lime-400 shadow-[0_0_18px_rgba(163,230,53,0.55)]" />
          <div className="truncate text-sm font-[900] tracking-wide text-white">{title}</div>
        </div>
        <button
          onClick={onExit}
          className="flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[12px] font-bold text-white transition hover:bg-white/15"
        >
          Back
        </button>
      </div>
      <iframe title={title} src={src} className="h-full w-full flex-1 border-0 bg-black" />
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ employee, onLogout }: { employee: string; onLogout: () => void }) {
  const initials = employee.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black">
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-[100px] w-full items-center justify-between gap-4"
      >
        {/* Logo — pinned to the absolute left corner */}
        <div className="flex shrink-0 items-center pl-4 md:pl-6">
          <img 
            src={coactLogoLight} 
            alt="COACT.AI" 
            className="h-20 w-auto md:h-24 object-contain" 
            style={{ imageRendering: 'auto' }} 
            loading="eager" 
          />
        </div>

        {/* Center: Nav links pill */}
        <div className="hidden items-center gap-1 rounded-2xl border border-white/10 bg-white/10 p-1 md:flex">
          {[
            { label: "Home", href: "#" },
            { label: "Games", href: "#games-section" },
            { label: "Leaderboard", href: "#leaderboard" },
          ].map((item, i) => (
            <a key={item.label} href={item.href}
              className={cn("rounded-xl px-5 py-1.5 text-[13px] font-bold transition-all",
                i === 0 ? "bg-white text-slate-900 shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
              )}>
              {item.label}
            </a>
          ))}
        </div>

        {/* Right: Employee badge + logout */}
        <div className="flex items-center gap-2 pr-4 md:pr-6">
          <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/10 py-1 pl-1.5 pr-3 sm:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-lime-400 to-green-600 text-[11px] font-black text-white shadow">
              {initials}
            </div>
            <span className="max-w-[110px] truncate text-[12px] font-bold text-white">{employee}</span>
          </div>
          <button onClick={onLogout} title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/70 transition hover:border-red-400/50 hover:bg-red-500/20 hover:text-red-400">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </motion.nav>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ onExplore }: { onExplore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  return (
    <section ref={ref} className="relative flex min-h-[80vh] w-full flex-col items-center justify-center px-6 py-16 text-center">
      <div 
        className="absolute inset-0"
        style={{ 
          backgroundImage: `url(${landingPageBg})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/50" />
      </div>
      
      <motion.div style={{ y, opacity }} className="relative z-10 w-full max-w-[1100px]">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>

          {/* Content */}
          <div>
            {/* Pill badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white backdrop-blur-sm shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-lime-400" />
              Real-time AI · Computer Vision · Hand Tracking
            </div>

            {/* Main headline */}
            <h1 className="text-[60px] font-[900] leading-[0.90] tracking-[-0.05em] md:text-[92px] lg:text-[116px]">
              <span className="bg-gradient-to-b from-[#bef264] via-[#4ade80] to-[#22c55e] bg-clip-text text-transparent">
                AI GAMES
              </span>
              <br />
              <span className="text-white">HUB</span>
            </h1>

            {/* Sub */}
            <p className="mx-auto mt-7 max-w-[560px] text-[17px] font-medium leading-[1.65] text-white/90">
              Play intelligent games powered by AI and human interaction. Step in, raise your hand, and let COACT read your every move.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <button onClick={onExplore}
                className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-lime-500 to-green-600 px-8 py-3.5 text-[15px] font-bold text-white shadow-lg transition hover:from-lime-400 hover:to-green-500 active:scale-[0.98]">
                Explore Games
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <a href="#leaderboard"
                className="flex items-center gap-2 rounded-full border-2 border-white/40 bg-white/10 px-8 py-3.5 text-[15px] font-bold text-white backdrop-blur-sm transition hover:border-lime-400 hover:bg-white/20">
                View Leaderboard
              </a>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────
function FilterTabs({ filterMode, setFilterMode }: { filterMode: "all" | GameMode; setFilterMode: (m: "all" | GameMode) => void }) {
  const tabs: { id: "all" | GameMode; label: string; count: number }[] = [
    { id: "all",    label: "All Games",     count: games.length },
    { id: "multi",  label: "Multiplayer",   count: games.filter((g) => g.mode === "multi").length },
    { id: "single", label: "Single Player", count: games.filter((g) => g.mode === "single").length },
  ];
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm">
      {tabs.map((tab) => {
        const active = filterMode === tab.id;
        return (
          <button key={tab.id} onClick={() => setFilterMode(tab.id)}
            className={cn("flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-bold transition-all",
              active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
            {tab.label}
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-black",
              active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Game Card ────────────────────────────────────────────────────────────────
function GameCard({ game, index, onPlay }: { game: Game; index: number; onPlay: () => void }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.5, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white bg-white shadow-[0_1px_16px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.11)]"
    >
      {/* Thumbnail */}
      <div className="relative h-[180px] w-full overflow-hidden">
        {game.imageFit === "contain" ? (
          <>
            <div
              className="absolute inset-0 scale-[1.08] bg-cover bg-center blur-xl"
              style={{ backgroundImage: `url(${game.image})` }}
            />
            <div className="absolute inset-0 bg-black/20" />
            <img
              src={game.image}
              alt={game.title}
              className="relative h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.04]"
            />
          </>
        ) : (
          <img
            src={game.image}
            alt={game.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
        {/* dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

        {/* Category pill – bottom left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-md">
          <div className={cn("flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gradient-to-br text-white shadow", game.accent)}>
            <span className="scale-75">{game.icon}</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white">{game.category}</span>
        </div>

        {/* Mode badge – top right */}
        <div className="absolute right-3 top-3">
          <div className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md",
            game.mode === "multi" ? "bg-lime-500/90" : "bg-indigo-500/90")}>
            {game.mode === "multi" ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {game.mode === "multi" ? "2P" : "SOLO"}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4 gap-3">
        <div>
          <h3 className="text-[16px] font-[800] leading-snug tracking-tight text-slate-900">{game.title}</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500 line-clamp-2">{game.description}</p>
        </div>

        {/* Feature chips */}
        <div className="flex flex-wrap gap-1.5">
          {game.features.slice(0, 3).map((f) => (
            <span key={f} className="inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: game.accentHex }} />
              {f}
            </span>
          ))}
        </div>

        {/* Play button – always at bottom */}
        <button onClick={onPlay}
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-[13px] font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98]">
          <Play className="h-3.5 w-3.5" fill="currentColor" />
          PLAY NOW
        </button>
      </div>
    </motion.article>
  );
}

// ─── Game Info Page (for non-routed single-player games) ──────────────────────
function GameInfoPage({ game, onClose }: { game: Game; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto" style={{ background: "#f2fbf4" }}>
      <div className="sticky top-0 z-10 border-b border-green-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow", game.accent)}>{game.icon}</div>
            <div>
              <div className="text-[10px] font-bold tracking-widest text-slate-500">{game.category}</div>
              <div className="text-[16px] font-[800] text-slate-900">{game.title}</div>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className={cn("mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br text-white shadow-2xl", game.accent)}>
          <div className="scale-[1.6]">{game.icon}</div>
        </div>
        <h1 className="text-3xl font-[900] tracking-tight text-slate-900">{game.title}</h1>
        <p className="mt-3 text-base text-slate-600">{game.description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {game.features.map((f) => (
            <span key={f} className="rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-semibold text-green-700">{f}</span>
          ))}
        </div>
        <p className="mt-14 text-sm text-slate-400">Full experience launching soon.</p>
      </div>
    </div>
  );
}

// ─── Loading Dots ─────────────────────────────────────────────────────────────
function LoadingDots() {
  const colors = ["#3b82f6","#8b5cf6","#06b6d4","#22c55e","#f97316"];
  return (
    <div className="flex items-center gap-3">
      {colors.map((color, i) => (
        <motion.div key={i} className="h-3 w-3 rounded-full" style={{ backgroundColor: color }}
          animate={{ y: [0, -14, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.75, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }} />
      ))}
    </div>
  );
}

// ─── Neural Background (subtle, green tint) ───────────────────────────────────
function NeuralBackground() {
  const nodes = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100, size: Math.random() * 2 + 1,
  })), []);
  return (
    <svg className="absolute inset-0 h-full w-full opacity-[0.05]">
      <defs><radialGradient id="ng"><stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#22c55e" stopOpacity="0" /></radialGradient></defs>
      {nodes.map((n, i) => (<g key={n.id}>{nodes.slice(i + 1).map((m) => {const d=Math.hypot(n.x-m.x,n.y-m.y);return d<18?<line key={`${n.id}-${m.id}`} x1={`${n.x}%`} y1={`${n.y}%`} x2={`${m.x}%`} y2={`${m.y}%`} stroke="#22c55e" strokeWidth="0.5" opacity={(1-d/18)*0.7} />:null;})}<circle cx={`${n.x}%`} cy={`${n.y}%`} r={n.size} fill="url(#ng)" /></g>))}
    </svg>
  );
}

export { NeuralBackground };
