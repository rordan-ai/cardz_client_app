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
    const card_number = String(body?.card_number || "").trim();
    const product_name = String(body?.product_name || "").trim() || "מוצר";
    const is_prepaid = Boolean(body?.is_prepaid);

    if (!business_code || !customer_phone_raw || !card_number) {
      return new Response(
        JSON.stringify({ error: "Missing business_code, customer_phone, or card_number" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const customer_phone = normalizePhone(customer_phone_raw);

    // ולידציה: ודא שהכרטיסייה שייכת ללקוח ולעסק ופעילה
    const { data: cardRow, error: cardErr } = await supabaseAdmin
      .from("PunchCards")
      .select("card_number, business_code, customer_phone, status")
      .eq("card_number", card_number)
      .maybeSingle();

    if (cardErr) {
      console.error("[punch-request-create] card lookup error", cardErr);
      return new Response(JSON.stringify({ error: "Card lookup failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!cardRow) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rowPhone = String(cardRow.customer_phone || "").trim();
    const rowPhoneNorm = normalizePhone(rowPhone);
    const samePhone = rowPhone === customer_phone_raw || rowPhone === customer_phone || rowPhoneNorm === customer_phone;
    const sameBusiness = String(cardRow.business_code || "").trim() === business_code;
    const isActive = String(cardRow.status || "").trim() === "active";

    if (!sameBusiness || !samePhone || !isActive) {
      return new Response(JSON.stringify({ error: "Card does not match customer/business or not active" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabaseAdmin
      .from("punch_requests")
      .insert({
        business_code,
        customer_phone: customer_phone_raw,
        card_number,
        product_name,
        is_prepaid,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[punch-request-create] insert error", error);
      return new Response(JSON.stringify({ error: "Failed to create punch request" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ id: data.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[punch-request-create] exception", e?.message || e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});


