-- Soft delete support for customers with scheduled hard delete
-- Adds deleted_at (soft delete marker) and hard_delete_after (retention window end)
alter table if exists customers
  add column if not exists deleted_at timestamptz;

alter table if exists customers
  add column if not exists hard_delete_after timestamptz;

create index if not exists idx_customers_deleted_at on customers (deleted_at);
create index if not exists idx_customers_hard_delete_after on customers (hard_delete_after);

-- Suggested RLS policy (to be applied by admin):
-- 1) Exclude soft-deleted rows from regular selects:
--    USING (deleted_at is null)
-- 2) Allow owner/self-service delete to mark deleted_at (via RPC/Edge Function)
-- 3) Optionally anonymize PII at soft delete time


