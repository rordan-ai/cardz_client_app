// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function normalizePhone(p?: string): string {
  if (!p) return "";
  const trimmed = String(p).trim();
  if (/^05\d{8}$/.test(trimmed)) return `972${trimmed.slice(1)}`;
  return trimmed.replace(/[^0-9]/g, "");
}

function rand4(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
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

    if (!business_code || !customer_phone_raw || !card_number) {
      return new Response(
        JSON.stringify({ error: "Missing business_code, customer_phone, or card_number" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const customer_phone_norm = normalizePhone(customer_phone_raw);

    // ולידציה: ודא שהכרטיסייה שייכת ללקוח ולעסק ופעילה, ושהיא מלאה (מותר לחדש רק כשהיא מלאה)
    const { data: cardRow, error: cardErr } = await supabaseAdmin
      .from("PunchCards")
      .select("card_number, business_code, customer_phone, status, product_code, total_punches, used_punches, benefit, prepaid, renewal_count")
      .eq("card_number", card_number)
      .maybeSingle();

    if (cardErr) {
      console.error("[punch-card-renew] card lookup error", cardErr);
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

    const rowPhone = String((cardRow as any).customer_phone || "").trim();
    const rowPhoneNorm = normalizePhone(rowPhone);
    const samePhone =
      rowPhone === customer_phone_raw ||
      rowPhone === customer_phone_norm ||
      rowPhoneNorm === customer_phone_norm;
    const sameBusiness = String((cardRow as any).business_code || "").trim() === business_code;
    const isActive = String((cardRow as any).status || "").trim() === "active";

    if (!sameBusiness || !samePhone || !isActive) {
      return new Response(JSON.stringify({ error: "Card does not match customer/business or not active" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const used = Number((cardRow as any).used_punches ?? NaN);
    const total = Number((cardRow as any).total_punches ?? NaN);
    const isFull = Number.isFinite(used) && Number.isFinite(total) && used >= total;
    if (!isFull) {
      return new Response(JSON.stringify({ error: "Card is not full" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const product_code = String((cardRow as any).product_code || "").trim();
    if (!product_code) {
      return new Response(JSON.stringify({ error: "Missing product_code on card" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const total_punches = Number((cardRow as any).total_punches ?? 0);
    const benefit = (cardRow as any).benefit ?? null;
    // לפי הדרישה: כרטיסייה חדשה תמיד נפתחת כ"לא שולם מראש" (רק אדמין רשאי לשנות אחרי תשלום)
    const prepaid = "לא";
    const prevRenewal = Number((cardRow as any).renewal_count ?? 0) || 0;
    // שמירה על פורמט הטלפון בדיוק כמו בכרטיסייה הישנה כדי שלא תהיה אי-התאמה בפילטרים/מסכים
    const customer_phone_for_new = String((cardRow as any).customer_phone || "").trim() || customer_phone_raw;

    // יצירת card_number חדש: "{business_code}-{phone}-{random4digits}"
    let new_card_number = "";
    let insertOk = false;
    for (let i = 0; i < 5; i++) {
      new_card_number = `${business_code}-${customer_phone_norm}-${rand4()}`;
      const { error: insertErr } = await supabaseAdmin
        .from("PunchCards")
        .insert({
          business_code,
          customer_phone: customer_phone_for_new,
          product_code,
          card_number: new_card_number,
          total_punches,
          used_punches: 0,
          status: "active",
          benefit,
          prepaid,
          renewal_count: prevRenewal + 1,
          last_action_date: new Date().toISOString(),
        });
      if (!insertErr) {
        insertOk = true;
        break;
      }
      console.error("[punch-card-renew] insert attempt failed", insertErr);
    }

    if (!insertOk) {
      return new Response(JSON.stringify({ error: "Failed to create new card" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // כיבוי הכרטיסייה הישנה (לא מופיעה יותר ב-active)
    const { error: updateOldErr } = await supabaseAdmin
      .from("PunchCards")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
        last_action_date: new Date().toISOString(),
      })
      .eq("card_number", card_number);

    if (updateOldErr) {
      console.error("[punch-card-renew] failed to complete old card", updateOldErr);
      // rollback best-effort: לא להשאיר כרטיסייה חדשה אם הישנה לא עודכנה
      try {
        await supabaseAdmin.from("PunchCards").delete().eq("card_number", new_card_number);
      } catch {}
      return new Response(JSON.stringify({ error: "Failed to finalize renewal" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ new_card_number, product_code }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[punch-card-renew] exception", e?.message || e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});


