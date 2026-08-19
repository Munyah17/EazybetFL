import type { SupabaseClient } from "@supabase/supabase-js";
import { paynowPoll, isPaynowPaid } from "@/lib/paynow/client";
import { ecocashLookup, normalizeMsisdn, isSuccessStatusMessage } from "@/lib/ecocash/client";
import type { Database } from "@/types/database";

/**
 * Safety net for deposits that never resolve. Normal completion happens
 * via the provider's webhook, or the client actively polling
 * /api/deposits/paynow/[id]/status while the user waits on the result
 * page -- but if the webhook never arrives (network blip, our server
 * momentarily down) *and* the user closes the tab before either finishes,
 * a real payment the gateway actually collected would otherwise sit in
 * `processing` forever with no way to know it ever happened. This
 * actively re-verifies with the actual gateway (never trusts our own
 * stale `processing` row) for anything left over a few minutes, the same
 * way the status route and the EcoCash webhook already do.
 *
 * Runs once a day as part of /api/cron/sync-settlement (Vercel's
 * free-tier cron-job cap forced consolidation -- see that route). Not
 * fast, but turns "stuck forever" into "resolved within a day", which is
 * the actual gap: without this there was no fallback at all.
 */
export async function reconcileStuckDeposits(
  supabase: SupabaseClient<Database>
): Promise<{ checked: number; completed: number; failed: number; errors: string[] }> {
  const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();

  const { data: stuck, error } = await supabase
    .from("deposits")
    .select("id, provider, method, amount, phone_number, client_correlator, created_at")
    .eq("status", "processing")
    .lt("created_at", cutoff)
    .limit(200);

  if (error || !stuck) {
    return { checked: 0, completed: 0, failed: 0, errors: [error?.message ?? "query failed"] };
  }

  let completed = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const d of stuck) {
    try {
      if (d.provider === "paynow") {
        if (!d.client_correlator) continue; // no pollurl on record -- nothing to reconcile against
        const poll = await paynowPoll(d.client_correlator);
        if (isPaynowPaid(poll.status ?? "")) {
          const { error: rpcErr } = await supabase.rpc("fn_complete_deposit", { p_deposit_id: d.id });
          if (rpcErr) errors.push(`${d.id}: ${rpcErr.message}`);
          else completed++;
        } else if ((poll.status ?? "").toLowerCase() === "cancelled") {
          await supabase.rpc("fn_fail_deposit", { p_deposit_id: d.id });
          await supabase.from("deposits").update({ status: "failed" }).eq("id", d.id);
          failedCount++;
        }
        // any other status (still awaiting payment, etc.) -- leave as processing, try again tomorrow
      } else if (d.provider === "ecocash_direct") {
        if (!d.phone_number || !d.client_correlator) continue;
        const verified = await ecocashLookup(normalizeMsisdn(d.phone_number), d.client_correlator);
        if (isSuccessStatusMessage(verified.statusMessage ?? "")) {
          const { error: rpcErr } = await supabase.rpc("fn_complete_deposit", { p_deposit_id: d.id });
          if (rpcErr) errors.push(`${d.id}: ${rpcErr.message}`);
          else completed++;
        } else if (verified.statusMessage) {
          // EcoCash returned a definitive non-success status -- not "still pending"
          await supabase.rpc("fn_fail_deposit", { p_deposit_id: d.id });
          await supabase.from("deposits").update({ status: "failed" }).eq("id", d.id);
          failedCount++;
        }
      }
    } catch (e) {
      errors.push(`${d.id}: ${(e as Error).message}`);
    }
  }

  return { checked: stuck.length, completed, failed: failedCount, errors };
}
