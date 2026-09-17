-- Run as database owner AFTER setting Vault secrets cofar_app_url and cofar_cron_secret.
-- For local Docker: cofar_app_url = http://host.docker.internal:3005
-- For production: use the HTTPS origin of this deployment.
-- CRON_AUTH_SECRET in the app must match cofar_cron_secret in Vault.
do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name = 'cofar_app_url')
    or not exists(select 1 from vault.decrypted_secrets where name = 'cofar_cron_secret') then
    raise exception 'Configure cofar_app_url and cofar_cron_secret in Vault first';
  end if;
end;
$$;
select cron.schedule('cofar-jobs-worker', '* * * * *', $cron$
  select net.http_post(
    url := (select rtrim(decrypted_secret, '/') from vault.decrypted_secrets where name = 'cofar_app_url') || '/api/cron/jobs',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cofar_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$cron$);
