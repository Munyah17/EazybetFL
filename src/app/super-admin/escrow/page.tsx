import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";

const TYPE_LABELS: Record<string, string> = {
  stake_escrowed: "Stake Escrowed",
  stake_lost_to_house: "Lost Bet → House",
  payout_funded_by_house: "Payout Funded by House",
  stake_refunded_from_escrow: "Stake Refunded",
};

export default async function EscrowPage() {
  const supabase = await createClient();
  const [{ data: ledger }, { data: transactions }] = await Promise.all([
    supabase.from("house_ledger").select("*").single(),
    supabase
      .from("house_ledger_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Escrow &amp; House Reserve</h1>
        <p className="text-sm text-muted-foreground">
          Every stake is held in escrow the instant a bet is placed. A loss releases it to the
          house reserve; a win releases it back to the player, topped up from the house reserve.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">In Escrow (open bets)</p>
          <p className="text-xl font-bold">{formatMoney(ledger?.escrow_balance ?? 0)}</p>
        </Card>
        <Card className="border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">House Reserve</p>
          <p className={`text-xl font-bold ${(ledger?.house_balance ?? 0) < 0 ? "text-destructive" : ""}`}>
            {formatMoney(ledger?.house_balance ?? 0)}
          </p>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Recent Activity</h2>
        {!transactions || transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No escrow activity yet.</p>
        ) : (
          <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
            {transactions.map((tx) => {
              // amount's sign is the *house reserve* delta -- meaningful only
              // for the two settlement types; stake_escrowed/refunded don't
              // move the house reserve at all, just escrow, so they're shown
              // neutrally rather than as a false "gain".
              const isHouseGain = tx.type === "stake_lost_to_house";
              const isHouseLoss = tx.type === "payout_funded_by_house";
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0"
                >
                  {isHouseGain ? (
                    <ArrowDownCircle className="size-5 shrink-0 text-primary" />
                  ) : isHouseLoss ? (
                    <ArrowUpCircle className="size-5 shrink-0 text-destructive" />
                  ) : (
                    <span className="size-5 shrink-0 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {TYPE_LABELS[tx.type] ?? tx.type}
                      </span>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {tx.reference_type ?? "system"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      isHouseGain ? "text-primary" : isHouseLoss ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {isHouseGain ? "+" : ""}
                    {formatMoney(Math.abs(Number(tx.amount)))}
                  </span>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
