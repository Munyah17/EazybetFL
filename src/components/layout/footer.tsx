import Link from "next/link";
import { Logo } from "@/components/layout/logo";

const COLUMNS = [
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About EazyBet" },
      { href: "/promotions", label: "Promotions" },
      { href: "/casino", label: "Spineazy Casino" },
      { href: "/account/referral", label: "Refer & Earn" },
    ],
  },
  {
    heading: "Support",
    links: [
      { href: "/help", label: "Help Centre" },
      { href: "/contact", label: "Contact Us" },
      { href: "/load-bet", label: "Load a Bet" },
      { href: "/responsible-gambling", label: "Responsible Gambling" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/aml-policy", label: "AML Policy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-6 border-t border-border pb-20 lg:pb-8">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4 lg:px-5">
        <div className="col-span-2 sm:col-span-1">
          <Logo />
          <p className="mt-2 max-w-xs text-xs text-muted-foreground">
            Bet fast, win big. Licensed sports betting and casino entertainment.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {col.heading}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-foreground/80 hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-[1440px] border-t border-border px-4 py-4 lg:px-5">
        <p className="text-xs text-muted-foreground">
          EazyBet is committed to responsible gambling. You must be 18+ to bet. Please play responsibly.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          © {new Date().getFullYear()} EazyBet. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
