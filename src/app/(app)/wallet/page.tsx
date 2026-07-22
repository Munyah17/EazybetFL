import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getWalletSummary } from "@/lib/data/wallet";
import { formatMoney } from "@/lib/format";

const TX_LABELS: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  bet_stake: "Bet Stake",
  bet_payout: "Bet Winnings",
  bet_refund: "Bet Refund",
  bonus_credit: "Bonus Credit",
  bonus_debit: "Bonus Debit",
  cashout: "Cash Out",
  adjustment: "Adjustment",
  booking_release: "Booking Release",
};

export default async function WalletPage() {
  const { user } = await requireUser();
  const { wallet, totalDeposits, totalWithdrawals, transactions } = await getWalletSummary(user.id);

  return (
    <div className="flex flex-col">
      <PageHeader title="Wallet" backHref="/account" />

      <div className="flex flex-col gap-4 p-4">
        <Card className="items-center border-border/60 bg-card p-6 text-center">
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="text-3xl font-extrabold text-primary">{formatMoney(wallet?.balance ?? 0)}</p>
          <div className="mt-3 grid w-full grid-cols-2 gap-2">
            <Button asChild>
              <Link href="/wallet/deposit">Deposit</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/wallet/withdraw">Withdraw</Link>
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Deposits</p>
            <p className="text-lg font-bold">{formatMoney(totalDeposits)}</p>
          </Card>
          <Card className="border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Withdrawals</p>
            <p className="text-lg font-bold">{formatMoney(totalWithdrawals)}</p>
          </Card>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">Recent Transactions</h2>
          </div>

          {transactions.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
              {transactions.map((tx) => {
                const isCredit = Number(tx.amount) >= 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0"
                  >
                    {isCredit ? (
                      <ArrowDownCircle className="size-5 shrink-0 text-primary" />
                    ) : (
                      <ArrowUpCircle className="size-5 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{TX_LABELS[tx.type] ?? tx.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-bold ${isCredit ? "text-primary" : "text-destructive"}`}>
                      {isCredit ? "+" : ""}
                      {formatMoney(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
