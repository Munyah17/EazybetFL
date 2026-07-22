"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  accent: "primary" | "boost" | "info";
};

const ACCENT_CLASS: Record<HeroSlide["accent"], string> = {
  primary: "from-primary/25 via-card to-card",
  boost: "from-boost/20 via-card to-card",
  info: "from-[#4ea8ff]/20 via-card to-card",
};

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);

  const next = useCallback(() => setIndex((i) => (i + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className="relative mx-3 mt-3 overflow-hidden lg:mx-0">
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide) => (
          <div key={slide.id} className="w-full shrink-0">
            <div
              className={cn(
                "flex min-h-36 flex-col justify-center gap-1 bg-gradient-to-br px-5 py-5 lg:min-h-44 lg:px-8",
                ACCENT_CLASS[slide.accent]
              )}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-boost">{slide.eyebrow}</p>
              <h2 className="text-xl font-extrabold leading-tight lg:text-2xl">{slide.title}</h2>
              <p className="max-w-md text-sm text-muted-foreground">{slide.description}</p>
              <Button asChild size="sm" className="mt-2 w-fit">
                <Link href={slide.ctaHref}>{slide.ctaLabel}</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center bg-background/70 text-foreground hover:bg-background lg:flex"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={next}
            aria-label="Next slide"
            className="absolute right-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center bg-background/70 text-foreground hover:bg-background lg:flex"
          >
            <ChevronRight className="size-4" />
          </button>

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn("h-1.5 w-4 transition-colors", i === index ? "bg-primary" : "bg-white/25")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
