"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  backHref,
  action,
}: {
  title: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
      {backHref ? (
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={backHref} aria-label="Back">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => router.back()}
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </Button>
      )}
      <h1 className="flex-1 truncate text-base font-semibold">{title}</h1>
      {action}
      <Button asChild variant="ghost" size="icon" className="shrink-0" aria-label="Back to home">
        <Link href="/">
          <Home className="size-5" />
        </Link>
      </Button>
    </header>
  );
}
