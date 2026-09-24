// Supabase Edge Function: customer-activity-log
// Purpose: Return the signed-in CUSTOMER's own activity feed for the app "My Activity"
//          screen (P1). Fixes empty screen since 2026-05-27 (anon SELECT on activity_logs
//          is RLS-blocked; reads must go through service_role here).
// Security: Two identification modes:
//           (a) body.id_token — Firebase ID token, verified, phone extracted from token.
//           (b) body.phone — free-form phone param, matching what the client sends
//               (client has no Firebase session on this screen). Phone-enumeration
//               hardening deliberately deferred by product decision 21.08.2026 —
//               tracked in cards-admin-web/docs/FUTURE_DEVELOPMENTS.md.
//           anon INSERTs to activity_logs are unchanged.
// Request:  POST { business_code, phone | id_token, limit? }
// Response: { ok, phone, activity_logs[], punch_requests[], voucher_logs[] }
//
// NOTE (phone format): Firebase returns E.164 (+9725XXXXXXXX). The DB stores local
// format (05XXXXXXXX) per client code (P2/P3). We query ALL variants defensively so
// matching is robust regardless of the canonical stored format.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jwtVerify, createRemoteJWKSet } from "https://esm.sh/jose@5";

const FIREBASE_PROJECT = "business-digital-punch-cards";
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com"),
);

// action_types the customer app knows how to render ("הפעילות שלי":
// mapActionToLabelAndAmount / mapRowToLabelAndAmount in app/(tabs)/PunchCard.tsx).
//
// ALLOWLIST, not denylist. The client renders any unknown action_type as its raw
// English name with amount +1 — i.e. a fake punch. Under the old denylist (trigger
// duplicates only) every other row keyed on the customer's phone leaked into the feed:
// the app's own 'add_customer' (written on every remote join), admin bookkeeping such as
// 'update_customer' / 'soft_delete_customer' / 'restore_customer' / 'delete_card',
// and every new type added later ('card_payment_status', 'notification_pref_change').
// With an allowlist a new action type is hidden by default instead of leaking until
// someone remembers to exclude it.
//
// The trigger duplicates (punch_added / punch_removed / punch_used / punch_unuse) are
// mapped by the client but deliberately ABSENT here — they duplicate the real rows.
// Voucher history also arrives separately via voucher_logs below.
//
// ⚠️ Keep in sync with the client mapper. Adding a type here without a client label
// shows it raw with +1; adding a client label without listing it here hides it.
const CUSTOMER_VISIBLE_ACTIONS = [
  "punch", "nfc_punch", "nfc", "add_punch", "stamp", "add_stamp",
  "void_punch", "cancel_punch",
  "card_renewal", "renew", "renew_card",
  "voucher_issued", "voucher_used", "voucher_expired", "voucher_received", "voucher_sent",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Build the set of phone formats to match against DB rows.
function phoneVariants(e164: string): string[] {
  const raw = (e164 || "").trim();
  if (!raw) return [];
  const v = new Set<string>();
  v.add(raw);                                  // +972501234567
  const digits = raw.replace(/[^\d]/g, "");    // 972501234567
  if (digits) v.add(digits);
  if (digits.startsWith("972")) v.add("0" + digits.slice(3)); // 0501234567 (IL local)
  return [...v].filter(Boolean);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed - use POST" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "Missing Supabase configuration" }, 500);
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const business_code = body?.business_code;
    if (!business_code || typeof business_code !== "string") {
      return json({ ok: false, error: "business_code is required" }, 400);
    }

    // --- Identify the customer: verified id_token if provided, else body.phone ---
    // NOTE: the Authorization header is NOT read as a token — supabase-js invoke()
    // always sends the anon key there, which is not a Firebase ID token.
    const idToken = String(body?.id_token || "");
    let phone = "";
    if (idToken) {
      try {
        const { payload } = await jwtVerify(idToken, JWKS, {
          issuer: `https://securetoken.google.com/${FIREBASE_PROJECT}`,
          audience: FIREBASE_PROJECT,
        });
        phone = String((payload as any)?.phone_number || "");
      } catch (e) {
        return json({ ok: false, error: "invalid_token: " + String((e as any)?.message || e) }, 401);
      }
      if (!phone) return json({ ok: false, error: "token has no phone_number" }, 403);
    } else {
      phone = String(body?.phone || "").trim();
      if (!phone) return json({ ok: false, error: "phone or id_token is required" }, 400);
    }

    const variants = phoneVariants(phone);
    if (!variants.length) return json({ ok: false, error: "could not derive phone" }, 403);

    const max = Math.min(Number(body?.limit) || 300, 3000);

    // activity_logs: user_id OR target_entity matches any variant; only types the
    // client can render (see CUSTOMER_VISIBLE_ACTIONS — trigger dupes excluded there).
    const orParts: string[] = [];
    for (const v of variants) { orParts.push(`user_id.eq.${v}`); orParts.push(`target_entity.eq.${v}`); }
    const alQ = supabase
      .from("activity_logs")
      .select("*")
      .eq("business_code", business_code)
      .or(orParts.join(","))
      .in("action_type", CUSTOMER_VISIBLE_ACTIONS)
      .order("timestamp", { ascending: false })
      .limit(max);

    // punch_requests + voucher_logs by customer_phone (defensive: tolerate schema/RLS diffs).
    const prQ = supabase.from("punch_requests").select("*")
      .eq("business_code", business_code).in("customer_phone", variants)
      .order("created_at", { ascending: false }).limit(max);
    const vlQ = supabase.from("voucher_logs").select("*")
      .eq("business_code", business_code)
      .in("customer_phone", variants)
      .order("created_at", { ascending: false }).limit(max);

    const [al, pr, vl] = await Promise.all([alQ, prQ, vlQ]);
    if (al.error) return json({ ok: false, error: "activity_logs: " + al.error.message }, 500);

    return json({
      ok: true,
      phone,
      activity_logs: al.data || [],
      punch_requests: pr.error ? [] : (pr.data || []),
      voucher_logs: vl.error ? [] : (vl.data || []),
    });
  } catch (err) {
    return json({ ok: false, error: String((err as any)?.message || err) }, 500);
  }
});
