import { PlayersHands, Landmark } from "../hooks/useHandTracking";

export function drawHands(
  ctx: CanvasRenderingContext2D,
  hands: PlayersHands,
  W: number,
  H: number,
  opts?: { showLandmarks?: boolean }
) {
  const draw = (h: any, color: string) => {
    if (!h) return;
    ctx.save();
    if (opts?.showLandmarks !== false) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      h.landmarks.forEach((p: any) => {
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 25;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(h.centerX * W, h.centerY * H, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  draw(hands.p1, "#10b981");
  draw(hands.p2, "#f97316");
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  W: number,
  H: number
) {
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.fillRect(0, 0, W, H);
  if (video.readyState >= 2) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.drawImage(video, 0, 0, W, H);
    ctx.restore();
  }
  // divider
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawWinner(
  ctx: CanvasRenderingContext2D,
  text: string,
  sub: string,
  W: number,
  H: number
) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 72px system-ui";
  ctx.fillText(text, W / 2, H / 2);
  ctx.font = "22px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(sub, W / 2, H / 2 + 55);
  ctx.restore();
}

// Clamp hand position to a player's half (left or right)
export function clampToHalf(
  x: number,
  side: "left" | "right",
  margin = 0.05
): number {
  if (side === "left") return Math.max(margin, Math.min(0.5 - margin, x));
  return Math.max(0.5 + margin, Math.min(1 - margin, x));
}

// Map a landmark's x coordinate relative to a half (0 = half edge, 1 = center)
export function normalizeWithinHalf(
  x: number,
  side: "left" | "right"
): number {
  if (side === "left") return Math.max(0, Math.min(1, x / 0.5));
  return Math.max(0, Math.min(1, (x - 0.5) / 0.5));
}

export type { Landmark };
