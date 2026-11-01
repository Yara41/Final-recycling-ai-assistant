-- Secret for the weekly insights job, generated inside the database and kept only in
-- Supabase Vault. Nobody has to copy it anywhere: pg_cron reads it from Vault to call
-- the `insights` function, and the function asks the database to check it.

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret');
  end if;
end $$;

create or replace function public.verify_cron_secret(p_secret text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(p_secret, '') <> ''
     and exists (select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret = p_secret)
$$;

revoke execute on function public.verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;
