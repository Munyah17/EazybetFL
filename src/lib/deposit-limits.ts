/** Shared between the Paynow and EcoCash deposit routes. Numbers are
 * deliberately generous, not tuned to real fraud data yet -- the point is
 * closing the "no limit at all" gap, not guessing the perfect ceiling. */
export const MAX_SINGLE_DEPOSIT = 2000;
export const MAX_DEPOSIT_ATTEMPTS_PER_HOUR = 10;
