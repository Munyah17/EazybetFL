/**
 * Zimbabwe mobile number handling. Users type their number every possible
 * way -- 0771234567, 771234567, 263771234567, +263 77 123 4567 -- and a
 * sloppy normalizer at signup (only stripped leading zeros) stored values
 * like "+263263771234567" (doubled country code) and "+26377 123 4567"
 * (spaces kept), which then failed the exact-string match at phone login.
 *
 * Canonical form: "+263" + the 9-digit subscriber number (7XXXXXXXX).
 */
export function normalizeZwPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, "");
  // strip any number of leading 263 country codes (handles the doubled case)
  while (digits.startsWith("263")) digits = digits.slice(3);
  // strip the national trunk prefix
  digits = digits.replace(/^0+/, "");
  // ZW mobile subscriber numbers are exactly 9 digits and start with 7
  if (!/^7\d{8}$/.test(digits)) return null;
  return `+263${digits}`;
}

/** The bare 9-digit subscriber number -- the stable key for matching a
 * typed number against stored ones regardless of formatting. */
export function zwPhoneKey(input: string | null | undefined): string | null {
  const digits = String(input ?? "").replace(/\D/g, "");
  const tail = digits.replace(/^(263)+/, "").replace(/^0+/, "");
  return /^7\d{8}$/.test(tail) ? tail : null;
}
