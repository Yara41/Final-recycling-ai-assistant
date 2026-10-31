-- Weekly proactive insights: every Monday 06:17 UTC, pg_cron calls the `insights`
-- Edge Function, which analyses the last 7 days for every active university.
--
-- Apply AFTER deploying the functions and creating two Vault secrets
-- (Dashboard → Project Settings → Vault, or SQL):
--   select vault.create_secret('https://uwxksbwlzjrjlccbdjtk.supabase.co/functions/v1/insights', 'insights_url');
--   select vault.create_secret('<same value as the CRON_SECRET function secret>', 'cron_secret');
-- pg_cron and pg_net are available on the Supabase Free plan.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'ecowaste-weekly-insights',
  '17 6 * * 1',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'insights_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
