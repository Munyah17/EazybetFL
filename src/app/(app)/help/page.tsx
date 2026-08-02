import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Help Centre | EazyBet" };

const FAQS = [
  {
    q: "How do I deposit money into my wallet?",
    a: "Go to Wallet → Deposit and choose EcoCash, OneMoney, InnBucks, Omari, Mukuru, or a payment card. Your balance updates automatically once the payment confirms.",
  },
  {
    q: "How do I withdraw my winnings?",
    a: "Go to Wallet → Withdraw, choose your payout method, and confirm the amount. Withdrawals are reviewed and paid out to the account or mobile money number on file.",
  },
  {
    q: "What is Cash Out and when can I use it?",
    a: "Cash Out lets you settle an open bet early for a value based on its current live odds, before the event finishes. It's available on eligible open bets from the bet slip or My Bets.",
  },
  {
    q: "How do booking codes work?",
    a: "After building a bet slip, you can save it as a booking code instead of placing it immediately. Share or store the code, then enter it under Load Bet to bring those selections back into your slip.",
  },
  {
    q: "What are vouchers and how do I redeem one?",
    a: "Vouchers are prepaid codes you can buy from an EazyBet agent or in-store. Go to Wallet → Redeem Voucher, enter the code, and its value is added to your wallet instantly.",
  },
  {
    q: "What is a Cash Agent?",
    a: "A Cash Agent can process cash deposits and withdrawals for you in person. Link your account to an agent's code from the Wallet page.",
  },
  {
    q: "Where did the Casino go?",
    a: "Casino games are provided by Spineazy, a separate site that shares your EazyBet-style wallet experience. The Casino link in the menu takes you there.",
  },
  {
    q: "I forgot my password — what do I do?",
    a: "Use the \"Forgot password\" link on the sign-in page to reset it via email.",
  },
];

export default function HelpPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Help Centre" backHref="/" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 text-sm leading-relaxed">
        <p className="rounded-lg border border-border/60 bg-card p-4 text-xs text-muted-foreground">
          Can&apos;t find what you&apos;re looking for?{" "}
          <a href="/contact" className="text-primary hover:underline">
            Contact us
          </a>{" "}
          directly.
        </p>

        {FAQS.map((item) => (
          <section key={item.q} className="flex flex-col gap-1.5">
            <h2 className="text-sm font-semibold text-foreground">{item.q}</h2>
            <p className="text-muted-foreground">{item.a}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
