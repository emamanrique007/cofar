-- Storage is private and bound to an account folder: <account UUID>/<file>.
insert into storage.buckets(id, name, public, file_size_limit) values ('cofar-files', 'cofar-files', false, 20971520);
create policy files_read on storage.objects for select to authenticated
using (bucket_id = 'cofar-files' and (storage.foldername(name))[1] in (select account_id::text from public.users_by_accounts where user_id = (select auth.uid())));
create policy files_insert on storage.objects for insert to authenticated
with check (bucket_id = 'cofar-files' and (storage.foldername(name))[1] in (select account_id::text from public.users_by_accounts where user_id = (select auth.uid())));
create policy files_delete on storage.objects for delete to authenticated
using (bucket_id = 'cofar-files' and (storage.foldername(name))[1] in (select account_id::text from public.users_by_accounts where user_id = (select auth.uid())));
