import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Star, TrendingUp, User } from "lucide-react";
import { getLeaderboard, getEmployeeId } from "../utils/scoreStorage";

type Props = { currentEmployee: string, refreshKey?: number };

const GAME_NAMES: Record<string, string> = {
  "chess": "Chess AI",
  "face-puzzle": "Face Puzzle",
  "paddle-battle": "AI Paddle Battle",
  "racing": "AI Car Racing",
  "football": "AI Football",
  "frog": "Frog Jump"
};

export default function Leaderboard({ currentEmployee, refreshKey }: Props) {
  const currentId = getEmployeeId(currentEmployee);

  const [board, setBoard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const data = await getLeaderboard();
      setBoard(data);
      setLoading(false);
    }
    fetchData();
  }, [refreshKey]);

  const currentRank = board.findIndex((r) => getEmployeeId(r.name) === currentId);
  const currentUserScore = board.find((r) => getEmployeeId(r.name) === currentId);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-slate-200 bg-white p-20 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-lime-500 border-t-transparent"></div>
        <p className="text-slate-500">Loading leaderboard...</p>
      </div>
    );
  }

  if (board.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-green-200 bg-white/60 p-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
          <Trophy className="h-8 w-8 text-green-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">No scores yet</h3>
          <p className="mt-1 text-sm text-slate-500">Play a game to appear on the leaderboard!</p>
        </div>
      </div>
    );
  }

  const podium = board.slice(0, 3);
  const rankGradient = (rank: number) =>
    rank === 0 ? "from-amber-400 to-orange-500" :
    rank === 1 ? "from-slate-300 to-slate-400" :
    "from-amber-600 to-orange-700";

  const rankIcon = (rank: number) =>
    rank === 0 ? <Trophy className="h-4 w-4 text-white" /> :
    rank === 1 ? <Medal className="h-4 w-4 text-white" /> :
    rank === 2 ? <Star className="h-4 w-4 text-white" /> :
    <span className="text-xs font-bold text-white">#{rank + 1}</span>;

  return (
    <div className="space-y-6">
      {/* Top 3 Podium */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-3xl border border-white bg-white p-7 shadow-[0_2px_24px_rgba(0,0,0,0.06)]"
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] text-lime-600">TOP 3 PLAYERS</div>
            <h3 className="text-[20px] font-[800] tracking-tight text-slate-900">Overall Ranking</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-lime-500 to-green-600 shadow-md">
            <Trophy className="h-5 w-5 text-white" />
          </div>
        </div>

        {/* Podium columns */}
        <div className="flex items-end justify-center gap-4 pt-6">
          {/* 2nd */}
          {podium[1] && (
            <PodiumCol rank={1} name={podium[1].name} score={podium[1].score}
              gradient={rankGradient(1)} icon={rankIcon(1)} height="h-28"
              isCurrent={getEmployeeId(podium[1].name) === currentId} games={podium[1].games} />
          )}
          {/* 1st */}
          {podium[0] && (
            <PodiumCol rank={0} name={podium[0].name} score={podium[0].score}
              gradient={rankGradient(0)} icon={rankIcon(0)} height="h-36"
              isCurrent={getEmployeeId(podium[0].name) === currentId} games={podium[0].games} />
          )}
          {/* 3rd */}
          {podium[2] && (
            <PodiumCol rank={2} name={podium[2].name} score={podium[2].score}
              gradient={rankGradient(2)} icon={rankIcon(2)} height="h-24"
              isCurrent={getEmployeeId(podium[2].name) === currentId} games={podium[2].games} />
          )}
        </div>
      </motion.div>

      {/* Your Score Section */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-3xl border-2 border-lime-300 bg-gradient-to-r from-lime-50 to-green-50 p-7 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-500 to-green-600 text-white shadow-lg">
              <User className="h-7 w-7" />
            </div>
            <div>
              <div className="text-sm font-bold text-lime-700 uppercase tracking-wider">Your Score</div>
              <div className="text-2xl font-black text-slate-900">{currentEmployee}</div>
            </div>
          </div>
          <div className="text-right">
            {currentUserScore ? (
              <>
                <div className="text-4xl font-black text-lime-600">{currentUserScore.score.toLocaleString()}</div>
                <div className="text-xs font-bold text-lime-700 uppercase tracking-wider">Total Points</div>
                <div className="text-sm text-slate-600 mt-1">Rank: {currentRank >= 0 ? `#${currentRank + 1}` : "Not ranked yet"}</div>
              </>
            ) : (
              <div className="text-lg font-semibold text-slate-600">Play a game to get your first score!</div>
            )}
          </div>
        </div>
        {currentUserScore?.games && currentUserScore.games.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {currentUserScore.games.map((game: any) => (
              <div key={game.game_id} className="rounded-xl bg-white/70 p-3 shadow-sm">
                <div className="text-[11px] font-bold text-slate-600">{GAME_NAMES[game.game_id] || game.game_id}</div>
                <div className="text-lg font-black text-lime-600">{game.total_score.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500">Best: {game.best_score.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Rest of Rankings */}
      {board.length > 3 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border border-white bg-white p-7 shadow-[0_2px_24px_rgba(0,0,0,0.06)]"
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-[18px] font-[800] tracking-tight text-slate-900">More Rankings</h3>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <TrendingUp className="h-3.5 w-3.5 text-lime-500" />
              {board.length} players total
            </div>
          </div>

          <div className="space-y-2">
            {board.slice(3).map((row, i) => {
              const isCurrent = getEmployeeId(row.name) === currentId;
              const rank = i + 3;

              return (
                <div key={row.name}
                  className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 transition-all ${
                    isCurrent
                      ? "border-lime-300 bg-gradient-to-r from-lime-50 to-green-50 shadow-sm"
                      : "border-slate-100 bg-slate-50/60 hover:border-slate-200 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ${rankGradient(rank)}`}>
                      {rankIcon(rank)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-[15px] font-bold ${isCurrent ? "text-green-900" : "text-slate-900"}`}>
                        {row.name}
                        {isCurrent && (
                          <span className="ml-2 rounded-full bg-lime-500 px-2 py-0.5 text-[10px] font-bold text-white">YOU</span>
                        )}
                      </div>
                      <div className="text-[12px] text-slate-500">{row.attempts} sessions</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-[900] tabular-nums text-slate-900">{row.score.toLocaleString()}</div>
                    </div>
                  </div>
                  {row.games && row.games.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
                      {row.games.map((game: any) => (
                        <div key={game.game_id} className="rounded-lg bg-white/70 px-2 py-1.5 text-[10px]">
                          <div className="font-semibold text-slate-600">{GAME_NAMES[game.game_id] || game.game_id}</div>
                          <div className="font-bold text-lime-600">{game.total_score.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function PodiumCol({
  name, score, gradient, icon, height, isCurrent, games,
}: {
  rank: number; name: string; score: number; gradient: string;
  icon: React.ReactNode; height: string; isCurrent: boolean; games: any[];
}) {
  return (
    <div className="flex w-[100px] flex-col items-center">
      <div className="mb-6 text-center">
        <div className={`truncate text-[12px] font-bold max-w-[100px] ${isCurrent ? "text-lime-700" : "text-slate-700"}`}>
          {name}
          {isCurrent && <span className="block text-[9px] font-bold text-lime-500">YOU</span>}
        </div>
        <div className="text-[11px] font-bold tabular-nums text-slate-500">{score.toLocaleString()}</div>
      </div>
      <div className={`relative flex w-full items-end justify-center rounded-t-2xl bg-gradient-to-b ${gradient} ${height} shadow-lg`}>
        <div className="absolute -top-5 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br shadow-md"
          style={{ background: `var(--tw-gradient-stops)` }}
        >
          <div className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${gradient}`}>
            {icon}
          </div>
        </div>
      </div>
      {games && games.length > 0 && (
        <div className="mt-3 w-full space-y-1">
          {games.slice(0, 2).map((game) => (
            <div key={game.game_id} className="rounded-lg bg-slate-50 px-2 py-1 text-[10px]">
              <div className="font-semibold text-slate-600">{GAME_NAMES[game.game_id] || game.game_id}</div>
              <div className="font-bold text-lime-600">{game.total_score.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
