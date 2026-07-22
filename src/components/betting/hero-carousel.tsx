"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Banner } from "@/lib/data/banners";

const ACCENT_CLASS: Record<Banner["accent"], string> = {
  primary: "from-primary/25 via-card to-card",
  boost: "from-boost/20 via-card to-card",
  info: "from-[#4ea8ff]/20 via-card to-card",
};

export function HeroCarousel({ slides }: { slides: Banner[] }) {
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
          <div key={slide.id} className="relative w-full shrink-0">
            {slide.image_url && (
              // eslint-disable-next-line @next/next/no-img-element -- admin-supplied arbitrary URLs, no domain to allowlist
              <img
                src={slide.image_url}
                alt=""
                className="absolute inset-0 size-full object-cover"
                aria-hidden
              />
            )}
            <div
              className={cn(
                "relative flex min-h-[170px] flex-col justify-center gap-1 px-5 py-5 lg:min-h-[218px] lg:px-8",
                slide.image_url ? "bg-black/55" : cn("bg-gradient-to-br", ACCENT_CLASS[slide.accent])
              )}
            >
              {slide.eyebrow && (
                <p className="text-xs font-bold uppercase tracking-wide text-boost">{slide.eyebrow}</p>
              )}
              <h2 className="text-xl font-extrabold leading-tight lg:text-2xl">{slide.title}</h2>
              {slide.description && (
                <p className="max-w-md text-sm text-muted-foreground">{slide.description}</p>
              )}
              {slide.cta_label && slide.cta_href && (
                <Button asChild size="sm" className="mt-2 w-fit">
                  <Link href={slide.cta_href}>{slide.cta_label}</Link>
                </Button>
              )}
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
