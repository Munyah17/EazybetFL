import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Privacy Policy | EazyBet" };

export default function PrivacyPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Privacy Policy" backHref="/" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 text-sm leading-relaxed text-muted-foreground">
        <p className="rounded-lg border border-border/60 bg-card p-4 text-xs">
          This is placeholder copy, not legal advice. Have it reviewed by a
          lawyer familiar with data-protection law in your operating
          jurisdiction before accepting real-money deposits.
        </p>

        <Section title="1. Information We Collect">
          When you create an account we collect your name, email address,
          phone number, and date of birth. When you deposit or withdraw, we
          collect the payment details needed to process that transaction
          (e.g. mobile money number). We also keep a record of bets placed
          and wallet activity.
        </Section>

        <Section title="2. How We Use Your Information">
          Your information is used to operate your account, process
          deposits and withdrawals, verify your identity and age, send
          transactional notifications (deposit confirmations, withdrawal
          decisions, win notifications), and meet legal and regulatory
          obligations.
        </Section>

        <Section title="3. Payment Processors">
          Deposits and withdrawals are processed through third-party
          payment providers (e.g. Paynow, EcoCash). We share only the
          information those providers need to complete a transaction; we do
          not store your mobile money PIN or card details.
        </Section>

        <Section title="4. Data Retention">
          Account and transaction records are retained for as long as your
          account is active and for a period afterward as required for
          financial record-keeping and regulatory compliance.
        </Section>

        <Section title="5. Data Security">
          Access to account balances and betting history is restricted to
          you and authorized staff. We use industry-standard practices to
          protect stored data, including row-level access controls on your
          account information.
        </Section>

        <Section title="6. Your Rights">
          You can review and update your personal information from Account
          → Personal Information at any time. To request deletion of your
          account or data, contact support.
        </Section>

        <Section title="7. Changes to This Policy">
          This policy may be updated from time to time. Continued use of
          EazyBet after a change takes effect constitutes acceptance of the
          revised policy.
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
