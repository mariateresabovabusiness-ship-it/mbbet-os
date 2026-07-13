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
  prezzo_alt   numeric(10,2),
  nota_alt     text,
  ordine       int not null default 0,
  created_at   timestamptz not null default now(),
  unique (nome_collab, bookmaker)
);

-- Riseguibile: se la tabella esisteva già da un run precedente senza queste colonne
alter table collab_tariffe add column if not exists prezzo_alt numeric(10,2);
alter table collab_tariffe add column if not exists nota_alt text;

alter table collab_tariffe enable row level security;
drop policy if exists "anon_all_collab_tariffe" on collab_tariffe;
create policy "anon_all_collab_tariffe" on collab_tariffe
  for all to anon using (true) with check (true);

-- ── Tariffe di Alan ──────────────────────────────────────────────────
insert into collab_tariffe (nome_collab, bookmaker, prezzo, note, prezzo_alt, nota_alt, ordine) values
  ('Alan','Eurobet',20,null,null,null,1),
  ('Alan','Goldbet',20,null,null,null,2),
  ('Alan','Snai',25,null,null,null,3),
  ('Alan','Sisal',30,null,null,null,4),
  ('Alan','PokerStars',30,null,null,null,5),
  ('Alan','Stanleybet',10,null,null,null,6),
  ('Alan','Eplay24',10,null,null,null,7),
  ('Alan','William Hill',15,'carta cliente',null,null,8),
  ('Alan','Tombola',10,'carta cliente',null,null,9),
  ('Alan','Sunbet',10,null,null,null,10),
  ('Alan','MyLottery',5,'carta cliente',null,null,11),
  ('Alan','Quigioco',10,null,null,null,12),
  ('Alan','Betflag SPID',25,'Riuscito',10,'Non riuscito',13)
on conflict (nome_collab, bookmaker) do update set prezzo=excluded.prezzo, note=excluded.note, prezzo_alt=excluded.prezzo_alt, nota_alt=excluded.nota_alt, ordine=excluded.ordine;

select 'Migration Tariffe Collaboratore completata.' as risultato;
