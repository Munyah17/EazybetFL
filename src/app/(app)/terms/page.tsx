import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Terms & Conditions | EazyBet" };

export default function TermsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Terms & Conditions" backHref="/" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 text-sm leading-relaxed text-muted-foreground">
        <p className="rounded-lg border border-border/60 bg-card p-4 text-xs">
          This is placeholder copy, not legal advice. Have it reviewed by a
          lawyer familiar with betting/gaming regulation in your operating
          jurisdiction before accepting real-money deposits.
        </p>

        <Section title="1. Eligibility">
          You must be at least 18 years old and legally permitted to
          participate in betting activities in your jurisdiction to create an
          EazyBet account. By registering, you confirm that you meet these
          requirements.
        </Section>

        <Section title="2. Your Account">
          You are responsible for keeping your login credentials
          confidential and for all activity that takes place under your
          account. One account is permitted per person, address, and
          household.
        </Section>

        <Section title="3. Deposits & Withdrawals">
          Funds deposited into your wallet must come from a payment method
          registered in your own name. Withdrawals are paid out to the
          verified account or mobile money number on file. EazyBet reserves
          the right to request identity verification before processing a
          withdrawal.
        </Section>

        <Section title="4. Bets & Settlement">
          Odds are correct at the time a bet is placed and may change
          afterwards without affecting bets already confirmed. Bets are
          settled once an event's official result is confirmed. EazyBet
          reserves the right to void bets placed on markets affected by an
          error, including obviously incorrect odds.
        </Section>

        <Section title="5. Responsible Gambling">
          Betting should be entertainment, not a way to make money or escape
          financial difficulty. If you feel your betting is becoming a
          problem, tools to set deposit limits or self-exclude are available
          from support. Never bet more than you can afford to lose.
        </Section>

        <Section title="6. Account Suspension">
          EazyBet may suspend or close accounts suspected of fraud, bonus
          abuse, collusion, or violation of these terms, pending
          investigation.
        </Section>

        <Section title="7. Changes to These Terms">
          These terms may be updated from time to time. Continued use of
          EazyBet after a change takes effect constitutes acceptance of the
          revised terms.
        </Section>

        <Section title="8. Contact">
          Questions about these terms can be directed to support through the
          app.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
