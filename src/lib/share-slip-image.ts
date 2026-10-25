import QRCode from "qrcode";

export type SlipShareSelection = {
  fixtureLabel: string;
  marketName: string;
  selectionName: string;
  oddsPrice: number;
};

type SlipImageInput = {
  code: string;
  betType: string;
  selections: SlipShareSelection[];
  totalOdds: number;
  /** Absolute load-bet URL encoded in the QR + printed in the footer. */
  link: string;
};

// Same palette as the app's dark theme so the shared image reads as
// on-brand without shipping font files -- canvas falls back to system
// sans, which is close enough to the UI's typeface at these sizes.
const BG = "#0a0f0d";
const CARD = "#131a17";
const BORDER = "#26332c";
const TEXT = "#eef5f1";
const MUTED = "#8aa396";
const PRIMARY = "#1de582";

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Renders the branded share card (selections, total odds, bet code, QR)
 * to a PNG blob entirely client-side -- no image library needed. Height
 * grows with the number of selections. */
export async function generateSlipImage({
  code,
  betType,
  selections,
  totalOdds,
  link,
}: SlipImageInput): Promise<Blob> {
  const W = 640;
  const PAD = 28;
  const ROW_H = 58;
  const HEADER_H = 84;
  const TOTALS_H = 64;
  const FOOTER_H = 168;
  const H = PAD + HEADER_H + selections.length * ROW_H + 8 + TOTALS_H + 12 + FOOTER_H + PAD;

  const canvas = document.createElement("canvas");
  // 2x for sharp text on high-DPI shares (WhatsApp/Telegram previews).
  const scale = 2;
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.scale(scale, scale);

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Card
  roundRect(ctx, 12, 12, W - 24, H - 24, 18);
  ctx.fillStyle = CARD;
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();

  let y = PAD + 12;

  // Header
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = PRIMARY;
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText("EazyBet", PAD + 8, y + 26);
  const brandW = ctx.measureText("EazyBet").width;
  ctx.fillStyle = MUTED;
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillText("SHARED BETSLIP", PAD + 8 + brandW + 14, y + 24);
  y += HEADER_H - 28;

  // Selections
  const oddsColX = W - PAD - 8;
  for (const s of selections) {
    ctx.fillStyle = TEXT;
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.fillText(truncateToWidth(ctx, s.fixtureLabel, W - PAD * 2 - 110), PAD + 8, y + 4);

    ctx.fillStyle = MUTED;
    ctx.font = "400 12.5px system-ui, sans-serif";
    ctx.fillText(
      truncateToWidth(ctx, `${s.marketName} — ${s.selectionName}`, W - PAD * 2 - 110),
      PAD + 8,
      y + 24
    );

    ctx.fillStyle = PRIMARY;
    ctx.font = "700 17px system-ui, sans-serif";
    const odds = s.oddsPrice.toFixed(2);
    ctx.fillText(odds, oddsColX - ctx.measureText(odds).width, y + 14);

    y += ROW_H;
    ctx.strokeStyle = BORDER;
    ctx.beginPath();
    ctx.moveTo(PAD + 8, y - ROW_H / 2 + 16);
    ctx.lineTo(W - PAD - 8, y - ROW_H / 2 + 16);
    ctx.stroke();
    y += 8;
  }

  // Totals row
  ctx.fillStyle = MUTED;
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillText(betType.toUpperCase() + (selections.length > 1 ? ` · ${selections.length} LEGS` : ""), PAD + 8, y + 20);
  ctx.fillStyle = TEXT;
  ctx.font = "700 22px system-ui, sans-serif";
  const total = `@ ${totalOdds.toFixed(2)}`;
  ctx.fillText(total, oddsColX - ctx.measureText(total).width, y + 22);
  y += TOTALS_H - 14;

  // Footer: code box + QR
  const qrDataUrl = await QRCode.toDataURL(link, { margin: 0, width: 128, color: { dark: TEXT, light: CARD } });
  const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = qrDataUrl;
  });

  const qrSize = 104;
  const footerTop = y + 10;
  ctx.drawImage(qrImg, W - PAD - 8 - qrSize, footerTop, qrSize, qrSize);

  roundRect(ctx, PAD + 8, footerTop, W - PAD * 2 - qrSize - 32, 64, 10);
  ctx.strokeStyle = PRIMARY;
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = MUTED;
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText("BET CODE", PAD + 24, footerTop + 22);
  ctx.fillStyle = PRIMARY;
  ctx.font = "700 24px ui-monospace, monospace";
  ctx.fillText(code, PAD + 24, footerTop + 50);

  ctx.fillStyle = MUTED;
  ctx.font = "400 12px system-ui, sans-serif";
  ctx.fillText(
    truncateToWidth(ctx, "Load the same picks at " + link.replace(/^https?:\/\//, ""), W - PAD * 2 - 32),
    PAD + 8,
    footerTop + qrSize + 28
  );
  ctx.font = "400 11px system-ui, sans-serif";
  ctx.fillText("Odds may change at placement. Bet responsibly. 18+", PAD + 8, footerTop + qrSize + 48);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render image"))), "image/png")
  );
}
