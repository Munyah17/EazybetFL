const BASE_URL = process.env.ECOCASH_EIP_BASE_URL!;
const USERNAME = process.env.ECOCASH_EIP_BASIC_AUTH_USERNAME!;
const PASSWORD = process.env.ECOCASH_EIP_BASIC_AUTH_PASSWORD!;

function authHeader() {
  const token = Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");
  return `Basic ${token}`;
}

/** Normalizes 07XXXXXXXX / +2637XXXXXXXX / 2637XXXXXXXX to the bare
 * endUserId form EcoCash's sandbox expects, e.g. "773047653". */
export function normalizeMsisdn(input: string) {
  const digits = input.replace(/\D/g, "");
  return digits.replace(/^263/, "").replace(/^0+/, "");
}

export type EcoCashChargeResponse = {
  transactionId?: string;
  clientCorrelator: string;
  status?: string;
  statusCode?: string;
  statusMessage: string;
  amount?: number;
  currency?: string;
  endUserId?: string;
  timestamp?: string;
};

export async function ecocashCharge(params: {
  clientCorrelator: string;
  referenceCode: string;
  endUserId: string;
  amount: number;
  currency?: string;
  notifyUrl?: string;
}): Promise<EcoCashChargeResponse> {
  const body = {
    clientCorrelator: params.clientCorrelator,
    notifyUrl: params.notifyUrl ?? "",
    referenceCode: params.referenceCode,
    tranType: "MER",
    endUserId: params.endUserId,
    remarks: "EazyBet deposit",
    transactionOperationStatus: "Charged",
    paymentAmount: {
      charginginformation: {
        amount: params.amount,
        currency: params.currency ?? "USD",
        description: process.env.ECOCASH_MERCHANT_NAME ?? "EazyBet",
      },
      chargeMetaData: { channel: process.env.ECOCASH_CHANNEL ?? "POS" },
    },
    merchantCode: process.env.ECOCASH_MERCHANT_CODE,
    merchantPin: process.env.ECOCASH_MERCHANT_PIN,
    merchantNumber: process.env.ECOCASH_MERCHANT_NUMBER,
    countryCode: process.env.ECOCASH_COUNTRY_CODE ?? "ZW",
    terminalID: process.env.ECOCASH_TERMINAL_ID,
    location: "Harare",
    superMerchantName: process.env.ECOCASH_SUPER_MERCHANT_NAME ?? "ECOCASH",
    merchantName: process.env.ECOCASH_MERCHANT_NAME ?? "EazyBet",
  };

  const res = await fetch(`${BASE_URL}/transactions/amount/`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    // A hang here must surface as a thrown timeout, not block the request
    // until Vercel's own platform timeout kills it -- the caller (deposits
    // route) depends on this throwing so it can leave the deposit
    // "processing" rather than guess at an outcome.
    signal: AbortSignal.timeout(15_000),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.statusMessage ?? `EcoCash charge failed: ${res.status}`);
  }
  return json as EcoCashChargeResponse;
}

export async function ecocashLookup(endUserId: string, clientCorrelator: string) {
  const res = await fetch(
    `${BASE_URL}/${encodeURIComponent(endUserId)}/transactions/amount/${encodeURIComponent(clientCorrelator)}`,
    { headers: { Authorization: authHeader() }, cache: "no-store", signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`EcoCash lookup failed: ${res.status}`);
  return res.json() as Promise<EcoCashChargeResponse>;
}

export function isSuccessStatusMessage(message: string) {
  return /successful/i.test(message);
}
