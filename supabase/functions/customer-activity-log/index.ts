// Supabase Edge Function: customer-activity-log
// Purpose: Return the signed-in CUSTOMER's own activity feed for the app "My Activity"
//          screen (P1). Fixes empty screen since 2026-05-27 (anon SELECT on activity_logs
//          is RLS-blocked; reads must go through service_role here).
// Security: Verifies a Firebase ID token (securetoken, project business-digital-punch-cards)
//           and extracts phone_number FROM the verified token — NEVER a free-form param
//           (prevents phone enumeration). anon INSERTs to activity_logs are unchanged.
// Request:  POST { business_code, id_token, limit? }   (id_token = Firebase ID token;
//           may also be passed as "Authorization: Bearer <token>")
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

// action_types that are trigger-duplicates and hidden from the activity view.
const TRIGGER_ACTIONS = ["punch_added", "punch_removed", "punch_used", "punch_unuse"];

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

    // --- Firebase ID token: from body.id_token or Authorization: Bearer ---
    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
    const idToken = String(body?.id_token || bearer || "");
    if (!idToken) return json({ ok: false, error: "id_token is required" }, 401);

    // --- Verify token + extract phone (never trust a free-form phone param) ---
    let phone = "";
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

    const variants = phoneVariants(phone);
    if (!variants.length) return json({ ok: false, error: "could not derive phone" }, 403);

    const max = Math.min(Number(body?.limit) || 300, 3000);

    // activity_logs: user_id OR target_entity matches any variant; hide trigger dupes.
    const orParts: string[] = [];
    for (const v of variants) { orParts.push(`user_id.eq.${v}`); orParts.push(`target_entity.eq.${v}`); }
    const alQ = supabase
      .from("activity_logs")
      .select("*")
      .eq("business_code", business_code)
      .or(orParts.join(","))
      .not("action_type", "in", `(${TRIGGER_ACTIONS.join(",")})`)
      .order("timestamp", { ascending: false })
      .limit(max);

    // punch_requests + voucher_logs by customer_phone (defensive: tolerate schema/RLS diffs).
    const prQ = supabase.from("punch_requests").select("*")
      .eq("business_code", business_code).in("customer_phone", variants)
      .order("created_at", { ascending: false }).limit(max);
    const vlQ = supabase.from("voucher_logs").select("*")
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
