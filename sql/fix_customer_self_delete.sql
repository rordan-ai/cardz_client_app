-- תיקון פונקציית customer_self_delete - פתרון שגיאת ambiguous business_code
-- מנרמל business_code (מסיר אפסים מובילים) ומטפל בטלפון

create or replace function public.customer_self_delete(p_business_code text, p_customer_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bc       text := coalesce(trim(p_business_code), '');
  v_bc_norm  text := ltrim(v_bc, '0'); -- מנרמל קוד עסק (מסיר אפסים מובילים)
  v_raw      text := coalesce(trim(p_customer_phone), '');
  v_norm     text := case 
                      when v_raw ~ '^05[0-9]{8}$' then '972' || substring(v_raw from 2)
                      else regexp_replace(v_raw, '[^0-9]', '', 'g') 
                     end;
  v_now      timestamptz := now();
  v_after30  timestamptz := now() + interval '30 days';
  v_updated  integer := 0;
begin
  -- עדכון לקוח: soft delete + אנונימיזציה
  update public.customers c
     set deleted_at = v_now,
         hard_delete_after = v_after30,
         name = ''
   where ltrim(c.business_code, '0') = v_bc_norm
     and c.customer_phone in (v_raw, v_norm)
     and c.deleted_at is null; -- רק אם לא נמחק כבר

  get diagnostics v_updated = row_count;

  -- הוספה ל-blacklist (push + sms)
  insert into public.notifications_blacklist (business_code, customer_phone, channel)
  values (v_bc, v_norm, 'push')
  on conflict (business_code, customer_phone, channel) do nothing;

  insert into public.notifications_blacklist (business_code, customer_phone, channel)
  values (v_bc, v_norm, 'sms')
  on conflict (business_code, customer_phone, channel) do nothing;

  return jsonb_build_object(
    'success', (v_updated >= 1),
    'updated', v_updated,
    'soft_deleted_at', v_now,
    'hard_delete_after', v_after30
  );
exception when others then
  return jsonb_build_object('success', false, 'error', SQLERRM);
end;
$$;

-- הרשאות
grant execute on function public.customer_self_delete(text, text) to anon, authenticated;

