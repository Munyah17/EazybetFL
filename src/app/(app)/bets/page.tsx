import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BetCard } from "@/components/betting/bet-card";
import { requireUser } from "@/lib/auth/require-user";
import { getBets } from "@/lib/data/bets";

export default async function BetsPage() {
  const { user } = await requireUser();
  const [all, open, cashedOut, settled] = await Promise.all([
    getBets(user.id),
    getBets(user.id, "open"),
    getBets(user.id, "cashed_out"),
    getBets(user.id, "settled"),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader title="My Bets" backHref="/" />

      <div className="p-3">
        <Tabs defaultValue="all">
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">
              All
            </TabsTrigger>
            <TabsTrigger value="open" className="flex-1">
              Open
            </TabsTrigger>
            <TabsTrigger value="cashout" className="flex-1">
              Cash Out
            </TabsTrigger>
            <TabsTrigger value="settled" className="flex-1">
              Settled
            </TabsTrigger>
          </TabsList>

          <BetTabContent value="all" bets={all} />
          <BetTabContent value="open" bets={open} />
          <BetTabContent value="cashout" bets={cashedOut} />
          <BetTabContent value="settled" bets={settled} />
        </Tabs>
      </div>
    </div>
  );
}

function BetTabContent({ value, bets }: { value: string; bets: Awaited<ReturnType<typeof getBets>> }) {
  return (
    <TabsContent value={value} className="flex flex-col gap-2 pt-3">
      {bets.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No bets here yet.</p>
      ) : (
        bets.map((bet) => <BetCard key={bet.id} bet={bet} />)
      )}
    </TabsContent>
  );
}
