-- MBBET OS · FIX URGENTE — parità anon/authenticated
--
-- Cosa è successo: prima di oggi OGNI pagina si collegava sempre con la sola
-- anon key (login finto), quindi TUTTE le tabelle con RLS attiva funzionavano
-- perché avevano una policy "anon_all_%" permissiva. Da quando il login è
-- diventato vero (Fase 1), un utente loggato usa il ruolo "authenticated" —
-- e molte tabelle NON hanno mai avuto una policy per quel ruolo, solo per
-- "anon". Risultato: quelle tabelle ora appaiono VUOTE per chi ha fatto il
-- login vero (es. bookmaker, operatori, spese, contratti, promo...).
--
-- Questa migration aggiunge, SOLO alle tabelle che oggi hanno esclusivamente
-- una policy anon (nessuno scoping per ruolo), una policy gemella per
-- "authenticated" con lo stesso accesso permissivo di prima — ripristina il
-- comportamento pre-Fase-1 per queste tabelle. NON tocca le tabelle dove ho
-- già scritto un vero scoping per ruolo (clienti, bonus, task, pagamenti,
-- collab, referral, documenti, penali, notifiche, utenti_crm) per non
-- annullare quel lavoro.
--
-- Sicura da rieseguire più volte.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'log','config','bookmaker','operatori',
    'allocation_rules','monthly_closures','capital_funds','capital_movements','financial_adjustments',
    'contratti','collab_payout','collab_tariffe','entrate_extra','promo_bookmaker',
    'social_ai_insights','social_leads','social_live_events','social_live_notes',
    'spese','social_media_library','telegram_seen_chats'
  ]
  loop
    begin
      execute format('create policy "authenticated_all_%s" on %I for all to authenticated using (true) with check (true)', tbl, tbl);
    exception when duplicate_object then null;
    when undefined_table then null;
    end;
  end loop;
end $$;

-- Storage: bucket "contratti" e "social-media" avevano solo policy anon
do $$ begin
  create policy "contratti authenticated select bucket" on storage.buckets for select to authenticated using (id = 'contratti');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "contratti authenticated select objects" on storage.objects for select to authenticated using (bucket_id = 'contratti');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "contratti authenticated insert objects" on storage.objects for insert to authenticated with check (bucket_id = 'contratti');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "contratti authenticated delete objects" on storage.objects for delete to authenticated using (bucket_id = 'contratti');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "social-media authenticated select" on storage.objects for select to authenticated using (bucket_id = 'social-media');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "social-media authenticated insert" on storage.objects for insert to authenticated with check (bucket_id = 'social-media');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "social-media authenticated delete" on storage.objects for delete to authenticated using (bucket_id = 'social-media');
exception when duplicate_object then null; end $$;

select 'Fix parità authenticated completato.' as risultato;
