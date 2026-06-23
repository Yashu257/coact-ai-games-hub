import { useEffect, useRef, useState } from "react";
import GameShell from "../../components/GameShell";
import WinnerScoreboard from "../../components/WinnerScoreboard";
import { useHandTracking } from "../../hooks/useHandTracking";
import { recordScore } from "../../utils/scoreStorage";

const GAME_ID = "paddle-battle";

type Props = { onExit: () => void; employeeName?: string };

export default function PaddleBattle({ onExit, employeeName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, handsRef } = useHandTracking(videoRef, true);

  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const stateRef = useRef({
    ball: { x: 0.5, y: 0.5, vx: 0.007, vy: 0.005 },
    p1Paddle: 0.5,
    p2Paddle: 0.5,
    p1Score: 0,
    p2Score: 0,
    winner: null as string | null,
  });

  const reset = () => {
    setP1Score(0);
    setP2Score(0);
    setWinner(null);
    stateRef.current = {
      ball: {
        x: 0.5,
        y: 0.5,
        vx: 0.007 * (Math.random() > 0.5 ? 1 : -1),
        vy: 0.005 * (Math.random() > 0.5 ? 1 : -1),
      },
      p1Paddle: 0.5,
      p2Paddle: 0.5,
      p1Score: 0,
      p2Score: 0,
      winner: null,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    let rafId = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) { rafId = requestAnimationFrame(loop); return; }
      const W = canvas.width;
      const H = canvas.height;

      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.fillRect(0, 0, W, H);
      if (video.readyState >= 2) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.drawImage(video, 0, 0, W, H);
        ctx.restore();
      }

      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      const hands = handsRef.current;
      const s = stateRef.current;

      if (!s.winner) {
        if (hands.p1) s.p1Paddle = hands.p1.centerY;
        if (hands.p2) s.p2Paddle = hands.p2.centerY;

        s.ball.x += s.ball.vx;
        s.ball.y += s.ball.vy;

        if (s.ball.y < 0.03 || s.ball.y > 0.97) {
          s.ball.vy = -s.ball.vy;
          s.ball.y = Math.max(0.03, Math.min(0.97, s.ball.y));
        }

        const paddleH = 0.18;
        if (s.ball.x < 0.06 && s.ball.vx < 0) {
          if (Math.abs(s.ball.y - s.p1Paddle) < paddleH / 2) {
            s.ball.vx = Math.abs(s.ball.vx) * 1.05;
            s.ball.x = 0.06;
          }
        }
        if (s.ball.x > 0.94 && s.ball.vx > 0) {
          if (Math.abs(s.ball.y - s.p2Paddle) < paddleH / 2) {
            s.ball.vx = -Math.abs(s.ball.vx) * 1.05;
            s.ball.x = 0.94;
          }
        }

        if (s.ball.x < 0) {
          s.p2Score++;
          setP2Score(s.p2Score);
          resetBall(s, -1);
        } else if (s.ball.x > 1) {
          s.p1Score++;
          setP1Score(s.p1Score);
          resetBall(s, 1);
        }

        const maxV = 0.022;
        s.ball.vx = Math.max(-maxV, Math.min(maxV, s.ball.vx));
        s.ball.vy = Math.max(-maxV, Math.min(maxV, s.ball.vy));

        if (s.p1Score >= 5) { 
          s.winner = "PLAYER 1 WINS!"; 
          setWinner(s.winner); 
          if (employeeName) { 
            recordScore(employeeName, GAME_ID, s.p1Score); 
          } 
        }
        else if (s.p2Score >= 5) { 
          s.winner = "PLAYER 2 WINS!"; 
          setWinner(s.winner); 
          if (employeeName) { 
            recordScore(employeeName, GAME_ID, s.p2Score); 
          } 
        }
      }

      drawPaddle(ctx, 0.04, s.p1Paddle, "#10b981", W, H);
      drawPaddle(ctx, 0.96, s.p2Paddle, "#f97316", W, H);

      ctx.save();
      ctx.shadowBlur = 30;
      ctx.shadowColor = "#fff";
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.ball.x * W, s.ball.y * H, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawHands(ctx, hands, W, H);

      if (s.winner) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = "bold 64px system-ui";
        ctx.fillText(s.winner, W / 2, H / 2);
        ctx.font = "20px system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillText("Press Restart to play again", W / 2, H / 2 + 50);
        ctx.restore();
      }

      rafId = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <GameShell
      title="Paddle Battle"
      category="Computer Vision"
      videoRef={videoRef}
      canvasRef={canvasRef}
      state={state}
      handsRef={handsRef}
      onExit={onExit}
      onRestart={reset}
      p1Score={p1Score}
      p2Score={p2Score}
      timer={null}
      extraHUD={
        <div className="rounded-full border border-white/20 bg-slate-900/70 px-4 py-1 text-xs text-white/80 backdrop-blur-xl">
          Move hand up/down to control paddle · First to 5
        </div>
      }
    >
      {winner && (
        <WinnerScoreboard
          stats={{
            title: "Paddle Battle Results",
            subtitle: "MATCH COMPLETE",
            p1: { score: p1Score },
            p2: { score: p2Score },
          }}
          onRestart={reset}
          onExit={onExit}
        />
      )}
    </GameShell>
  );
}

function resetBall(s: any, dir: number) {
  s.ball.x = 0.5;
  s.ball.y = 0.5;
  s.ball.vx = 0.007 * dir * (Math.random() > 0.5 ? 1 : -1);
  s.ball.vy = 0.005 * (Math.random() > 0.5 ? 1 : -1);
}

function drawPaddle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, W: number, H: number) {
  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.fillRect(x * W - 5, y * H - H * 0.09, 10, H * 0.18);
  ctx.restore();
}

export function drawHands(ctx: CanvasRenderingContext2D, hands: any, W: number, H: number) {
  const draw = (h: any, color: string) => {
    if (!h) return;
    ctx.save();
    ctx.fillStyle = color;
    h.landmarks.forEach((p: any) => {
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 25;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(h.centerX * W, h.centerY * H, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  draw(hands.p1, "#10b981");
  draw(hands.p2, "#f97316");
}
