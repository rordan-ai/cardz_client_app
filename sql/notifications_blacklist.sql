-- Unified notifications blacklist (push + sms)
create table if not exists notifications_blacklist (
  business_code text not null,
  customer_phone text not null,
  channel text not null check (channel in ('push','sms')),
  created_at timestamptz default now(),
  primary key (business_code, customer_phone, channel)
);

create index if not exists idx_nbl_bc_ch on notifications_blacklist (business_code, channel);
create index if not exists idx_nbl_phone on notifications_blacklist (customer_phone);

-- Example usage on server side (pseudo-SQL for sender queries):
-- SELECT ... FROM device_tokens dt
-- WHERE dt.business_code = :business_code
--   AND NOT EXISTS (
--     SELECT 1 FROM notifications_blacklist b
--     WHERE b.business_code = dt.business_code
--       AND b.customer_phone = dt.phone_number
--       AND b.channel = 'push'
--   );


