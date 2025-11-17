// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function normalizePhone(p?: string): string {
  if (!p) return "";
  const trimmed = p.trim();
  if (/^05\d{8}$/.test(trimmed)) return `972${trimmed.slice(1)}`;
  return trimmed.replace(/[^0-9]/g, "");
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }
    const body = await req.json();
    const business_code = String(body?.business_code || "").trim();
    const customer_phone_raw = String(body?.customer_phone || "").trim();
    if (!business_code || !customer_phone_raw) {
      return new Response(JSON.stringify({ error: "Missing business_code or customer_phone" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const customer_phone = normalizePhone(customer_phone_raw);

    // Soft delete + anonymize basic PII, schedule hard delete after 30 days
    const nowIso = new Date().toISOString();
    const after30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updErr } = await supabaseAdmin
      .from("customers")
      .update({
        deleted_at: nowIso,
        hard_delete_after: after30,
        name: "",
        // Optionally: additional anonymization fields here
      })
      .eq("business_code", business_code)
      .in("customer_phone", [customer_phone_raw, customer_phone]);

    if (updErr) {
      console.error("[customer-self-delete] update error", updErr);
      return new Response(JSON.stringify({ error: "Failed to soft-delete" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Add to unified notifications blacklist (push + sms)
    const blacklistRows = [
      { business_code, customer_phone, channel: "push" },
      { business_code, customer_phone, channel: "sms" },
    ];
    const { error: blErr } = await supabaseAdmin
      .from("notifications_blacklist")
      .upsert(blacklistRows);
    if (blErr) {
      console.warn("[customer-self-delete] blacklist upsert warning", blErr);
    }

    return new Response(
      JSON.stringify({ success: true, soft_deleted_at: nowIso, hard_delete_after: after30 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[customer-self-delete] exception", e?.message || e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});


