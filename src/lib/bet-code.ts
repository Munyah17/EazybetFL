/**
 * Human-facing ticket code for a betslip. Derived deterministically from the
 * slip's placement_group_id (or bet id) -- every selections row that came off
 * one slip shares that group id, so the code is identical everywhere the slip
 * is shown: confirmation toast, My Bets, settled lists.
 *
 * Format mirrors the booked-bet codes users already know (EBT-XXXX-XXXX).
 * Deterministic derivation means no extra column or backfill is needed and
 * old slips show a code too.
 */
export function betslipCode(id: string | null | undefined): string {
  if (!id) return "—";
  const hex = id.replace(/-/g, "").toUpperCase();
  return `EBT-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}
