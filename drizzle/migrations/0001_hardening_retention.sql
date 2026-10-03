-- 0001: hardening + retention support (idempotent)

-- 1) Audit log is append-only (MVP §6: "nikt nie modyfikuje audit_log").
revoke update, delete, truncate on public.audit_log from authenticated, anon;
create or replace function public.audit_log_immutable() returns trigger language plpgsql as $$
begin
  -- retention of org data cascades from organizations; allow that path only
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations o where o.id = old.org_id) then
    return old;
  end if;
  raise exception 'audit_log is append-only';
end $$;
drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- 2) Indexes used by inbox, purge and sender receipts.
create index if not exists items_recipient_inbox_idx on public.items (recipient_user_id, created_at desc) where archived_at is null;
create index if not exists items_clinic_inbox_idx on public.items (org_id, created_at desc) where recipient_user_id is null;
create index if not exists items_expires_idx on public.items (expires_at);
create index if not exists items_drop_link_idx on public.items (drop_link_id);
create index if not exists audit_log_org_created_idx on public.audit_log (org_id, created_at desc);
create index if not exists outbox_user_created_idx on public.notifications_outbox (user_id, created_at desc);

-- 3) Outbox retention: delivery logs older than 30 days are not needed (G3, minimisation).
create or replace function public.purge_old_outbox() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from notifications_outbox where created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_old_outbox() from public, anon, authenticated;

-- 4) Optional, in-database scheduling of the outbox cleanup (requires pg_cron; skipped when unavailable).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule('dh_outbox_cleanup') where exists (select 1 from cron.job where jobname = 'dh_outbox_cleanup');
    perform cron.schedule('dh_outbox_cleanup', '15 0 * * *', 'select public.purge_old_outbox()');
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end $$;
