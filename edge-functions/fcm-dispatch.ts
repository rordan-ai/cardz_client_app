// Edge Function: fcm-dispatch
// Filters out recipients that opted-out (notifications_blacklist, channel='push') before sending
// Deno + Supabase Edge Runtime

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type DispatchRequest = {
  business_code: string
  title?: string
  body?: string
  data?: Record<string, any>
  environment?: 'prod' | 'dev'
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 })
  }

  try {
    const { business_code, title, body, data, environment = 'prod' } = (await req.json()) as DispatchRequest
    if (!business_code) {
      return new Response(JSON.stringify({ error: 'business_code is required' }), { status: 400 })
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1) Fetch candidate device tokens for the business (supports both schemas: business_code OR business_codes array)
    //    We collect phone_number as well to check blacklist.
    const candidates: { token: string; phone_number: string | null }[] = []

    // a) devices with column business_code
    const { data: direct, error: directErr } = await supabase
      .from('device_tokens')
      .select('token, phone_number')
      .eq('business_code', business_code)
      .eq('environment', environment)

    if (directErr) {
      // keep going; some schemas use business_codes instead
      console.warn('fcm-dispatch: query direct business_code failed', directErr)
    } else if (direct) {
      candidates.push(...direct)
    }

    // b) devices with array business_codes (fallback)
    const { data: arrayBased, error: arrayErr } = await supabase
      .from('device_tokens')
      .select('token, phone_number, business_codes')
      .contains('business_codes', [business_code])
      .eq('environment', environment)

    if (arrayErr) {
      console.warn('fcm-dispatch: query array business_codes failed', arrayErr)
    } else if (arrayBased) {
      for (const r of arrayBased) {
        candidates.push({ token: r.token, phone_number: r.phone_number })
      }
    }

    // de-duplicate tokens
    const tokenSet = new Set<string>()
    const uniqueCandidates = candidates.filter((c) => {
      if (!c?.token) return false
      if (tokenSet.has(c.token)) return false
      tokenSet.add(c.token)
      return true
    })

    if (uniqueCandidates.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: 'no candidates' }), { status: 200 })
    }

    // 2) Fetch blacklist for 'push' for these phones (only phones present)
    const phones = Array.from(
      new Set(uniqueCandidates.map((c) => (c.phone_number || '').trim()).filter((p) => p.length > 0)),
    )

    let blacklistedPhones = new Set<string>()
    if (phones.length > 0) {
      const { data: bl, error: blErr } = await supabase
        .from('notifications_blacklist')
        .select('customer_phone')
        .eq('business_code', business_code)
        .eq('channel', 'push')
        .in('customer_phone', phones)

      if (blErr) {
        console.warn('fcm-dispatch: blacklist query error', blErr)
      } else if (bl) {
        blacklistedPhones = new Set(bl.map((r: any) => (r.customer_phone || '').trim()))
      }
    }

    // 3) Filter recipients
    const recipients = uniqueCandidates.filter((c) => {
      if (!c.phone_number) return true // if no phone, cannot match blacklist entry
      return !blacklistedPhones.has(c.phone_number.trim())
    })

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: 'all candidates blacklisted' }), {
        status: 200,
      })
    }

    // 4) Send via FCM HTTP v1 (pseudo; integrate with your FCM credentials/tokens)
    // NOTE: Provide your own FCM credentials and HTTP v1 call here.
    // For demo purposes, we only return how many would be sent.

    const tokens = recipients.map((r) => r.token)
    const payload = {
      notification: { title: title || '', body: body || '' },
      data: data || {},
      tokens,
    }

    // TODO: implement actual FCM send here with your service account
    // await sendFcmV1(payload)

    return new Response(JSON.stringify({ success: true, sent: tokens.length, payloadPreview: payload }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('fcm-dispatch error', error)
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500 })
  }
})


