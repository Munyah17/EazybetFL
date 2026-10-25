/**
 * Zimbabwe mobile number handling. Users type their number every possible
 * way -- 0771234567, 771234567, 263771234567, +263 77 123 4567 -- and a
 * sloppy normalizer at signup (only stripped leading zeros) stored values
 * like "+263263771234567" (doubled country code) and "+26377 123 4567"
 * (spaces kept), which then failed the exact-string match at phone login.
 *
 * Canonical form: E.164 ("+" + country code + subscriber digits).
 * Zimbabwean numbers keep normalizing to "+263" + the 9-digit subscriber
 * number (7XXXXXXXX); explicitly international input (+CC..., 00CC...) or
 * a bare number long enough to already carry a country code is kept as
 * its own "+<digits>" E.164 form -- foreign signups are supported.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Zimbabwean mobile: strip repeated 263 country codes (handles the
  // doubled "+263263..." case), then the trunk 0, then require the
  // 9-digit 7XXXXXXXX subscriber pattern.
  const zwTail = digits.replace(/^(263)+/, "").replace(/^0+/, "");
  if (/^7\d{8}$/.test(zwTail)) return `+263${zwTail}`;

  // Explicit international: "+CC..." or "00CC..." dialled form.
  if (/^(\+|00)/.test(raw)) {
    const intl = digits.replace(/^0+/, "");
    return /^[1-9]\d{6,14}$/.test(intl) ? `+${intl}` : null;
  }

  // Bare digits already carrying a country code, e.g. "27831234567".
  if (/^[1-9]\d{9,14}$/.test(digits)) return `+${digits}`;

  return null;
}

/** ZW-only normalizer, kept for rails that genuinely require a
 * Zimbabwean number (EcoCash, local payouts). */
export function normalizeZwPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  const tail = digits.replace(/^(263)+/, "").replace(/^0+/, "");
  return /^7\d{8}$/.test(tail) ? `+263${tail}` : null;
}

/** The bare 9-digit subscriber number -- the stable key for matching a
 * typed number against stored ones regardless of formatting. */
export function zwPhoneKey(input: string | null | undefined): string | null {
  const digits = String(input ?? "").replace(/\D/g, "");
  const tail = digits.replace(/^(263)+/, "").replace(/^0+/, "");
  return /^7\d{8}$/.test(tail) ? tail : null;
}
