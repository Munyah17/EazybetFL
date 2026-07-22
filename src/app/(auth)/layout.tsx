import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-center border-b border-border px-4 py-5">
        <Link href="/" aria-label="Back to EazyBet home">
          <Logo className="text-2xl" />
        </Link>
      </header>
      <main className="flex flex-1 flex-col justify-center px-5 py-8">
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
