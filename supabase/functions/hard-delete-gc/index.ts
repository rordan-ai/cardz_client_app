// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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
    const nowIso = new Date().toISOString();
    const { data: delData, error: delErr } = await supabaseAdmin
      .from("customers")
      .delete()
      .lt("hard_delete_after", nowIso);

    if (delErr) {
      console.error("[hard-delete-gc] delete error", delErr);
      return new Response(JSON.stringify({ error: "Failed to hard-delete" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    const deletedCount = Array.isArray(delData) ? delData.length : 0;
    return new Response(JSON.stringify({ success: true, deleted: deletedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[hard-delete-gc] exception", e?.message || e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});


