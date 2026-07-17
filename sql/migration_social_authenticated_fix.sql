-- MBBET OS · Fix: calendario Social vuoto per chi ha fatto login vero
--
-- social_posts (il calendario), social_content_ideas, social_risk_words
-- avevano una policy "authenticated" scritta in migration_social.sql, ma un
-- file successivo (ESEGUI_ORA_social.sql) ha ricreato le tabelle da zero
-- (DROP CASCADE) rimettendo solo la policy anon — la policy authenticated
-- è andata persa. La rimetto.

do $$ begin
  create policy "auth_all_social_posts" on social_posts for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth_all_risk_words" on social_risk_words for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth_all_content_ideas" on social_content_ideas for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

select 'Fix social completato.' as risultato;
