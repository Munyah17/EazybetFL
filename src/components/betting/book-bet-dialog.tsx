"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function BookBetDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Generates the QR image (an external, async canvas API) whenever the
    // code changes -- an external-system sync, not a plain state mirror.
    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQr(null);
      return;
    }
    QRCode.toDataURL(code, {
      width: 220,
      margin: 1,
      color: { dark: "#0a0f0d", light: "#eef5f1" },
    }).then(setQr);
  }, [code]);

  return (
    <Dialog open={!!code} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="text-primary">Your bet has been saved!</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Use the code below to load your bet later.
        </p>

        <div className="relative mx-auto flex w-full items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3">
          <span className="font-mono text-lg font-bold tracking-widest">{code}</span>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => {
              if (code) navigator.clipboard.writeText(code);
              setCopied(true);
              toast.success("Code copied");
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>

        {qr && (
          <div className="mx-auto flex flex-col items-center gap-2 py-2">
            <p className="text-xs text-muted-foreground">Scan QR Code to Load Bet</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Bet code QR" className="rounded-lg" width={200} height={200} />
            <p className="text-xs text-muted-foreground">This code is valid for 7 days</p>
          </div>
        )}

        <DialogFooter>
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
