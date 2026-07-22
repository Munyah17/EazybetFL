import crypto from "node:crypto";

const INTEGRATION_ID = process.env.PAYNOW_INTEGRATION_ID!;
const INTEGRATION_KEY = process.env.PAYNOW_INTEGRATION_KEY!;
const INITIATE_URL = "https://www.paynow.co.zw/interface/initiatetransaction";

/** Paynow's hash: concatenate field values in the exact order sent, append the
 * integration key, SHA512, uppercase hex. Field order matters -- Paynow
 * recomputes it server-side (and we do the same to validate webhooks). */
function computeHash(fields: Record<string, string>) {
  const concatenated = Object.values(fields).join("") + INTEGRATION_KEY;
  return crypto.createHash("sha512").update(concatenated, "utf8").digest("hex").toUpperCase();
}

function parseResponse(text: string) {
  const params = new URLSearchParams(text);
  return Object.fromEntries(params.entries());
}

export type PaynowInitiateResult = {
  status: string;
  browserurl?: string;
  pollurl?: string;
  error?: string;
};

export async function paynowInitiate(params: {
  reference: string;
  amount: number;
  authEmail: string;
  returnUrl: string;
  resultUrl: string;
  additionalInfo?: string;
}): Promise<PaynowInitiateResult> {
  const fields: Record<string, string> = {
    id: INTEGRATION_ID,
    reference: params.reference,
    amount: params.amount.toFixed(2),
    additionalinfo: params.additionalInfo ?? "EazyBet wallet deposit",
    returnurl: params.returnUrl,
    resulturl: params.resultUrl,
    authemail: params.authEmail,
    status: "Message",
  };
  const hash = computeHash(fields);
  const body = new URLSearchParams({ ...fields, hash });

  const res = await fetch(INITIATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  const parsed = parseResponse(await res.text());
  return {
    status: parsed.status ?? "Error",
    browserurl: parsed.browserurl,
    pollurl: parsed.pollurl,
    error: parsed.error,
  };
}

export async function paynowPoll(pollUrl: string) {
  const res = await fetch(pollUrl, { cache: "no-store" });
  return parseResponse(await res.text());
}

/** Validates an inbound resulturl webhook by recomputing the hash Paynow
 * attached, using the same field values (minus hash) in the order Paynow
 * sends them for status updates. */
export function verifyPaynowWebhook(fields: Record<string, string>) {
  const { hash, ...rest } = fields;
  if (!hash) return false;
  return computeHash(rest) === hash.toUpperCase();
}

export function isPaynowPaid(status: string) {
  return status.toLowerCase() === "paid" || status.toLowerCase() === "awaiting delivery";
}
