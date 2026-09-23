import "server-only";

/**
 * Groq — free-tier LLM inference used for the rare decisions that need
 * fuzzy intelligence rather than math (e.g. deciding whether a score-feed
 * match is the same fixture as ours when team names differ). NOT on the
 * cash-out hot path: pricing is deterministic math in SQL, because an LLM
 * round-trip is far too slow for per-request quotes.
 *
 * Set GROQ_API_KEY (console.groq.com, free) to enable. Every caller treats
 * a null return as "no opinion" and falls back to deterministic logic.
 */
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export async function groqDecide(system: string, user: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 256,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * Ask the model whether a feed result refers to the same fixture as ours.
 * Returns true/false, or null when Groq is unavailable or unsure -- the
 * caller must treat null as "no match" (never settle on a guess).
 */
export async function groqSameFixture(input: {
  ourHome: string;
  ourAway: string;
  feedHome: string;
  feedAway: string;
  ourKickoff: string;
  feedDate: string;
}): Promise<boolean | null> {
  const answer = await groqDecide(
    "You are a sports-data entity resolver. Decide if two team-name pairs refer to the same football fixture. Answer with exactly YES or NO.",
    `Our fixture: "${input.ourHome}" vs "${input.ourAway}", kickoff ${input.ourKickoff}.\n` +
      `Feed result: "${input.feedHome}" vs "${input.feedAway}", dated ${input.feedDate}.\n` +
      "Same fixture?"
  );
  if (answer === null) return null;
  const a = answer.trim().toUpperCase();
  if (a.startsWith("YES")) return true;
  if (a.startsWith("NO")) return false;
  return null;
}
