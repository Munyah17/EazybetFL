"use client";

import { useState } from "react";
import { Check, Copy, Download, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { generateSlipImage, type SlipShareSelection } from "@/lib/share-slip-image";

export type SharedSlip = {
  code: string;
  betType: string;
  totalOdds: number;
  selections: SlipShareSelection[];
};

const MAX_QR_LEN = 400;

export function ShareBetDialog({ slip, onClose }: { slip: SharedSlip | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!slip) return null;

  // window.location.origin over NEXT_PUBLIC_APP_URL -- same reason as the
  // auth flows: the env var has shipped "localhost" before, and the link
  // must open wherever the sharer actually is.
  const link = `${window.location.origin}/load-bet?code=${slip.code}`;
  const text =
    `Check out my betslip on EazyBet -- ${slip.selections.length} selection` +
    `${slip.selections.length > 1 ? "s" : ""} @ ${slip.totalOdds.toFixed(2)}. ` +
    `Play the same bet with code ${slip.code}`;

  async function copyLink() {
    await navigator.clipboard.writeText(`${text}\n${link}`);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  }

  async function nativeShare() {
    const payload = { title: "My EazyBet slip", text, url: link };
    if (navigator.share && navigator.canShare?.(payload) !== false) {
      try {
        await navigator.share(payload);
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    await copyLink();
  }

  async function downloadImage() {
    setDownloading(true);
    try {
      const blob = await generateSlipImage({
        code: slip!.code,
        betType: slip!.betType,
        selections: slip!.selections,
        totalOdds: slip!.totalOdds,
        link,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eazybet-slip-${slip!.code}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not create image");
    } finally {
      setDownloading(false);
    }
  }

  const socials = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(text + "\n" + link)}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}` },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text + " " + link)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
  ];

  return (
    <Dialog open={!!slip} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="text-primary">Share your betslip</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Anyone with this code or link can load the same picks into their own slip — they pay and
          place it themselves. Odds may have moved by then.
        </p>

        <div className="relative mx-auto flex w-full items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3">
          <span className="font-mono text-lg font-bold tracking-widest">{slip.code}</span>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={copyLink}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>

        <p className="break-all font-mono text-[11px] text-muted-foreground">
          {link.length > MAX_QR_LEN ? link.slice(0, MAX_QR_LEN) : link}
        </p>

        <Button className="w-full" onClick={nativeShare}>
          <Share2 className="size-4" /> Share link
        </Button>

        <div className="grid grid-cols-4 gap-2">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border bg-secondary py-2 text-xs font-semibold text-secondary-foreground hover:bg-accent"
            >
              {s.label}
            </a>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" className="w-full" disabled={downloading} onClick={downloadImage}>
            <Download className="size-4" />
            {downloading ? "Creating image…" : "Download image (PNG)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
