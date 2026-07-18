-- ═══════════════════════════════════════════════════════════════════
--   Fix Finanza: Spese non si aggiungono + Entrate Extra rotta
--   Incolla TUTTO questo blocco nella SQL Editor di Supabase e clicca RUN.
--   SAFE: usa IF NOT EXISTS, si può rieseguire senza problemi.
-- ═══════════════════════════════════════════════════════════════════

-- 1) SPESE: mancava la colonna "ricorrente" e il valore automatico dell'id
--    (per questo ogni volta che provavi ad aggiungere una spesa falliva)
--    NB: spese.id è di tipo text (non numero) -> id generato come UUID testuale
alter table spese
  add column if not exists ricorrente boolean default false;

alter table spese
  alter column id set default gen_random_uuid()::text;

-- 2) ENTRATE EXTRA: la tabella era sparita dalla cache del database
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

select 'Fix Spese + Entrate Extra completato.' as risultato;
