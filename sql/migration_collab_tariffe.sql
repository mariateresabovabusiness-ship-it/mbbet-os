-- ═══════════════════════════════════════════════════════════════════
--   MBBET OS · Migration: Tariffe Collaboratore
--   Elenco siti disponibili + prezzo per ciascun collaboratore,
--   indipendente dallo storico clienti (mostra anche siti a 0 clienti).
--   SAFE: usa IF NOT EXISTS, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

create table if not exists collab_tariffe (
  id           bigserial primary key,
  nome_collab  text not null,
  bookmaker    text not null,
  prezzo       numeric(10,2) not null default 0,
  note         text,
  ordine       int not null default 0,
  created_at   timestamptz not null default now(),
  unique (nome_collab, bookmaker)
);

alter table collab_tariffe enable row level security;
drop policy if exists "anon_all_collab_tariffe" on collab_tariffe;
create policy "anon_all_collab_tariffe" on collab_tariffe
  for all to anon using (true) with check (true);

-- ── Tariffe di Alan ──────────────────────────────────────────────────
insert into collab_tariffe (nome_collab, bookmaker, prezzo, note, ordine) values
  ('Alan','Eurobet',20,null,1),
  ('Alan','Goldbet',20,null,2),
  ('Alan','Snai',25,null,3),
  ('Alan','Sisal',30,null,4),
  ('Alan','PokerStars',30,null,5),
  ('Alan','Stanleybet',10,null,6),
  ('Alan','Eplay24',10,null,7),
  ('Alan','William Hill',15,'carta cliente',8),
  ('Alan','Tombola',10,'carta cliente',9),
  ('Alan','Sunbet',10,null,10),
  ('Alan','MyLottery',5,'carta cliente',11),
  ('Alan','Quigioco',10,null,12),
  ('Alan','Betflag',30,'SPID',13)
on conflict (nome_collab, bookmaker) do update set prezzo=excluded.prezzo, note=excluded.note, ordine=excluded.ordine;

select 'Migration Tariffe Collaboratore completata.' as risultato;
