/**
 * Never show raw Supabase/Postgres/network error text to users -- it leaks
 * schema/RPC/constraint details and looks unprofessional. This maps the
 * known `raise exception '<CODE>'` codes our RPCs throw (see
 * supabase/migrations) to short, friendly copy, and falls back to a generic
 * message for anything unrecognized (network errors, unexpected DB errors,
 * etc.) so nothing raw ever reaches a toast or inline error.
 */
const KNOWN_ERRORS: Record<string, string> = {
  AGENT_ALREADY_LINKED: "You're already linked to an agent.",
  AGENT_CODE_NOT_FOUND: "We couldn't find an agent with that code.",
  ALREADY_REVIEWED: "That request has already been reviewed.",
  BET_ALREADY_SETTLED: "This bet has already been settled.",
  BET_NOT_CASHOUTABLE: "This bet can no longer be cashed out.",
  BET_NOT_FOUND: "We couldn't find that bet.",
  CODE_CANCELLED: "That booking code has been cancelled.",
  CODE_EXPIRED: "That booking code has expired.",
  CODE_NOT_FOUND: "We couldn't find that booking code.",
  DEPOSIT_NOT_FOUND: "We couldn't find that deposit.",
  FIXTURE_NOT_AVAILABLE: "That match is no longer available.",
  INSUFFICIENT_FUNDS: "Insufficient balance.",
  INVALID_AMOUNT: "Please enter a valid amount.",
  INVALID_COUNT: "Please enter a valid quantity.",
  INVALID_STAKE: "Please enter a valid stake.",
  INVALID_SYSTEM_SIZE: "Please choose a valid system size.",
  MARKET_SUSPENDED: "That market is currently suspended.",
  MULTIPLE_REQUIRES_TWO_SELECTIONS: "A multiple bet needs at least two selections.",
  NOT_AUTHENTICATED: "Please sign in and try again.",
  NOT_AUTHORIZED: "You're not authorized to do that.",
  NOT_YOUR_CUSTOMER: "This customer isn't assigned to you.",
  NO_SELECTIONS: "Add at least one selection first.",
  OUTCOME_NOT_FOUND: "That selection is no longer available.",
  SELECTIONS_NOT_FULLY_SETTLED: "Not all selections have been settled yet.",
  VOUCHER_ALREADY_REDEEMED: "That voucher has already been redeemed.",
  VOUCHER_EXPIRED: "That voucher has expired.",
  VOUCHER_NOT_FOUND: "We couldn't find that voucher code.",
  VOUCHER_VOID: "That voucher is no longer valid.",
  WALLET_NOT_FOUND: "We couldn't find your wallet. Please contact support.",
  WITHDRAWAL_NOT_FOUND: "We couldn't find that withdrawal.",
};

const DEFAULT_FALLBACK = "Something went wrong. Please try again.";

function extractMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  // Supabase's PostgrestError (and similar) are plain objects, not `Error`
  // instances -- `instanceof Error` misses them entirely, which would make
  // every known code fall through to the generic fallback.
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "";
}

export function friendlyError(error: unknown, fallback: string = DEFAULT_FALLBACK): string {
  const raw = extractMessage(error);
  for (const [code, message] of Object.entries(KNOWN_ERRORS)) {
    if (raw.includes(code)) return message;
  }
  return fallback;
}
