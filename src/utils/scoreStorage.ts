// Per-employee score storage using MySQL backend.

const API_BASE = "http://localhost:3001/api";

export type GameScore = {
  best: number;
  attempts: number;
  history: number[]; // most recent first, max 10
  totalScore: number;
};

export type EmployeeRecord = {
  name: string;
  games: Record<string, GameScore>;
};

export type ScoreStore = Record<string, EmployeeRecord>;

const EMP_KEY = "ai_hub_employee";

export function getEmployeeId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

export async function recordScore(employeeName: string, gameId: string, score: number) {
  try {
    console.log("Recording score:", { employeeName, gameId, score });
    const response = await fetch(`${API_BASE}/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeName, gameId, score }),
    });
    const result = await response.json();
    console.log("Score recorded response:", result);
    return result;
  } catch (error) {
    console.error("Error recording score:", error);
  }
}

export async function setCurrentEmployee(name: string) {
  try {
    console.log("Setting current employee:", name);
    const response = await fetch(`${API_BASE}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const result = await response.json();
    console.log("Employee response:", result);
    localStorage.setItem(EMP_KEY, name);
  } catch (error) {
    console.error("Error setting employee:", error);
    localStorage.setItem(EMP_KEY, name);
  }
}

export async function getEmployeeScores(): Promise<{ id: string; name: string; total: number; games: number }[]> {
  return [];
}

export async function getLeaderboard(gameId?: string): Promise<{ name: string; score: number; attempts: number }[]> {
  try {
    const url = gameId 
      ? `${API_BASE}/leaderboard?gameId=${encodeURIComponent(gameId)}` 
      : `${API_BASE}/leaderboard`;
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return [];
  }
}

export function getCurrentEmployee(): string | null {
  try {
    return localStorage.getItem(EMP_KEY);
  } catch {
    return null;
  }
}

export function clearCurrentEmployee() {
  try {
    localStorage.removeItem(EMP_KEY);
  } catch {}
}

export async function getEmployeeGameStats(employeeName: string, gameId: string): Promise<GameScore | null> {
  try {
    const response = await fetch(`${API_BASE}/employees/${encodeURIComponent(employeeName)}/games`);
    const games = await response.json();
    const game = games.find((g: any) => g.game_id === gameId);
    if (game) {
      return {
        best: game.best_score,
        attempts: game.attempts,
        history: [],
        totalScore: game.total_score,
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching game stats:", error);
    return null;
  }
}

export async function loadScores(): Promise<ScoreStore> {
  return {};
}

export function saveScores(_: ScoreStore) {}

export function removeGameFromAllEmployees(_: string) {}
