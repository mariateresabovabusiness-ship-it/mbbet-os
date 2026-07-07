-- ═══════════════════════════════════════════════════════════════════
--   CRM MBBET · Migration: Spese condivise (Supabase, non più localStorage)
--   Prima le spese generali erano salvate solo nel browser di chi le
--   inseriva — nessun altro operatore le vedeva. Questa migration crea
--   una tabella reale condivisa da tutto il team.
--   SAFE: usa IF NOT EXISTS, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

create table if not exists spese (
  id            bigserial primary key,
  descrizione   text not null,
  categoria     text default 'Altro',
  importo       numeric(10,2) not null,
  data          date default current_date,
  created_at    timestamp default now()
);

alter table spese enable row level security;

drop policy if exists "anon_all_spese" on spese;
create policy "anon_all_spese" on spese
  for all to anon using (true) with check (true);

create index if not exists idx_spese_data on spese(data);

-- ── VERIFICA ─────────────────────────────────────────────────────
select 'Migration spese completata.' as risultato;
