import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Responsible Gambling | EazyBet" };

export default function ResponsibleGamblingPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Responsible Gambling" backHref="/" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 text-sm leading-relaxed text-muted-foreground">
        <p className="rounded-lg border border-border/60 bg-card p-4 text-xs">
          This is placeholder copy. Replace with your actual responsible
          gambling programme, self-exclusion process, and local helpline
          details before launch.
        </p>

        <Section title="Our Commitment">
          Betting should be entertainment, not a way to make money or escape
          financial difficulty. EazyBet is committed to helping customers
          stay in control of their play.
        </Section>

        <Section title="You Must Be 18+">
          EazyBet accounts are only available to individuals aged 18 or
          older. We may request identity verification to confirm your age at
          any time.
        </Section>

        <Section title="Signs Your Betting May Be a Problem">
          Chasing losses, betting more than you can afford, hiding your
          betting from people close to you, or feeling anxious when you&apos;re
          not able to bet are all signs worth paying attention to.
        </Section>

        <Section title="Tools to Stay in Control">
          Deposit limits, cool-off periods, and self-exclusion can be
          arranged by contacting support — reach out through the{" "}
          <a href="/contact" className="text-primary hover:underline">
            Contact
          </a>{" "}
          page and we&apos;ll set these up on your account.
        </Section>

        <Section title="Getting Help">
          If you feel your betting is becoming a problem, independent
          support is available. Local and national problem-gambling helpline
          details will be published here.
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
