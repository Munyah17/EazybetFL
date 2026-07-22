import type { HeroSlide } from "@/components/betting/hero-carousel";

const FALLBACK_SLIDES: HeroSlide[] = [
  {
    id: "fallback-winboost",
    eyebrow: "WinBoost",
    title: "Boost multiples by +3%",
    description: "Enable WinBoost on any 3+ selection multiple for a bigger payout.",
    ctaLabel: "Start a Multiple",
    ctaHref: "/sports",
    accent: "boost",
  },
  {
    id: "fallback-cashout",
    eyebrow: "Cash Out",
    title: "Take your winnings early",
    description: "Cash out open bets any time before the final whistle.",
    ctaLabel: "View My Bets",
    ctaHref: "/bets",
    accent: "info",
  },
  {
    id: "fallback-refer",
    eyebrow: "Refer & Earn",
    title: "Invite friends, earn rewards",
    description: "Share your code and both of you get a bonus on their first deposit.",
    ctaLabel: "Get My Code",
    ctaHref: "/account/referral",
    accent: "primary",
  },
  {
    id: "fallback-methods",
    eyebrow: "Fast Payments",
    title: "EcoCash, OneMoney & more",
    description: "Deposit and withdraw instantly with the payment methods you already use.",
    ctaLabel: "Deposit Now",
    ctaHref: "/wallet/deposit",
    accent: "primary",
  },
  {
    id: "fallback-casino",
    eyebrow: "Spineazy",
    title: "Slots & live casino",
    description: "Same wallet, same balance -- jump into Spineazy games any time.",
    ctaLabel: "Explore Casino",
    ctaHref: "/casino",
    accent: "boost",
  },
];

type PromotionRow = { id: string; title: string; description: string | null; type: string };

const TYPE_TO_HREF: Record<string, string> = {
  welcome_bonus: "/wallet/deposit",
  deposit_bonus: "/wallet/deposit",
  free_bet: "/sports",
  odds_boost: "/sports",
  cashback: "/promotions",
};

/** Always returns exactly 5 slides: real active promotions first, padded
 * with branded fallback slides so the carousel never looks sparse. */
export function buildHeroSlides(promotions: PromotionRow[]): HeroSlide[] {
  const fromPromotions: HeroSlide[] = promotions.slice(0, 5).map((p) => ({
    id: p.id,
    eyebrow: p.type.replace("_", " "),
    title: p.title,
    description: p.description ?? "",
    ctaLabel: "Learn More",
    ctaHref: TYPE_TO_HREF[p.type] ?? "/promotions",
    accent: "primary",
  }));

  const needed = 5 - fromPromotions.length;
  return [...fromPromotions, ...FALLBACK_SLIDES.slice(0, needed)];
}
