import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "AML Policy | EazyBet" };

export default function AmlPolicyPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="AML Policy" backHref="/" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 text-sm leading-relaxed text-muted-foreground">
        <p className="rounded-lg border border-border/60 bg-card p-4 text-xs">
          This is placeholder copy, not legal advice. Have it reviewed by a
          lawyer familiar with anti-money-laundering regulation in your
          operating jurisdiction before accepting real-money deposits.
        </p>

        <Section title="1. Purpose">
          EazyBet is committed to preventing the platform from being used for
          money laundering or the financing of terrorism, and to complying
          with applicable anti-money-laundering (AML) and counter-terrorist
          financing (CTF) laws.
        </Section>

        <Section title="2. Customer Due Diligence">
          We collect and verify identifying information at account creation
          and may request further identity or proof-of-address documentation
          before processing large deposits or withdrawals.
        </Section>

        <Section title="3. Source of Funds">
          Deposits must come from a payment method registered in the
          account holder&apos;s own name. We may ask you to confirm the source of
          funds for unusually large or frequent transactions.
        </Section>

        <Section title="4. Monitoring & Reporting">
          Account and transaction activity is monitored for patterns
          consistent with money laundering, structuring, or other suspicious
          behaviour. Suspicious activity is reported to the relevant
          authorities as required by law.
        </Section>

        <Section title="5. Record Keeping">
          Identity verification records and transaction history are retained
          for the period required by applicable regulation, even after an
          account is closed.
        </Section>

        <Section title="6. Sanctions Compliance">
          EazyBet does not knowingly provide services to individuals or
          entities subject to applicable sanctions lists.
        </Section>

        <Section title="7. Staff Training">
          Staff involved in payment processing and account review receive
          training on recognising and escalating suspicious activity.
        </Section>

        <Section title="8. Contact">
          Questions about this policy can be directed to support through the{" "}
          <a href="/contact" className="text-primary hover:underline">
            Contact
          </a>{" "}
          page.
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
