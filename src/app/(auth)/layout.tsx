import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="grid grid-cols-3 items-center border-b border-border px-4 py-5">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Back to Home</span>
        </Link>
        <Link href="/" aria-label="Back to EazyBet home" className="mx-auto">
          <Logo className="text-2xl" />
        </Link>
        <span />
      </header>
      <main className="flex flex-1 flex-col justify-center px-5 py-8">
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
