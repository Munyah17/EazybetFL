import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "About Us | EazyBet" };

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="About EazyBet" backHref="/" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 text-sm leading-relaxed text-muted-foreground">
        <p className="rounded-lg border border-border/60 bg-card p-4 text-xs">
          This is placeholder copy. Replace with your actual company details,
          licensing information, and registration numbers before launch.
        </p>

        <Section title="Who We Are">
          EazyBet is a sports betting platform built for Zimbabwe, offering
          live and pre-match odds, fast payouts, and a wallet that works the
          same whether you&apos;re topping up from a mobile money account or an
          EazyBet agent.
        </Section>

        <Section title="Our Mission">
          Bet fast, win big. We built EazyBet to make placing a bet as quick
          and reliable as sending a mobile money payment — clear odds, no
          hidden fees, and support when you need it.
        </Section>

        <Section title="Licensing & Regulation">
          EazyBet operates in accordance with applicable Zimbabwean betting
          and gaming regulations. Licence and registration details will be
          published here.
        </Section>

        <Section title="Payments We Support">
          Deposits and withdrawals via EcoCash, OneMoney, InnBucks, Omari,
          Mukuru, and major payment cards, plus in-person cash deposits and
          withdrawals through EazyBet agents.
        </Section>

        <Section title="Get in Touch">
          Questions about the platform? Visit our{" "}
          <a href="/contact" className="text-primary hover:underline">
            Contact
          </a>{" "}
          page or the{" "}
          <a href="/help" className="text-primary hover:underline">
            Help Centre
          </a>
          .
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
