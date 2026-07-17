-- ═══════════════════════════════════════════════════════════════════
--   Fix: tabella entrate_extra sparita dalla schema cache di PostgREST
--   (stesso problema già capitato con le funzioni rpc_* in questa sessione)
--   SAFE: usa IF NOT EXISTS, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

create table if not exists entrate_extra (
  id            bigserial primary key,
  descrizione   text not null,
  categoria     text default 'Altro',
  importo       numeric(10,2) not null,
  data          date default current_date,
  created_at    timestamp default now()
);

alter table entrate_extra enable row level security;

drop policy if exists "anon_all_entrate_extra" on entrate_extra;
create policy "anon_all_entrate_extra" on entrate_extra
  for all to anon using (true) with check (true);

drop policy if exists "auth_all_entrate_extra" on entrate_extra;
create policy "auth_all_entrate_extra" on entrate_extra
  for all to authenticated using (true) with check (true);

create index if not exists idx_entrate_extra_data on entrate_extra(data);

NOTIFY pgrst, 'reload schema';

select 'Fix entrate_extra completato.' as risultato;
