-- ═══════════════════════════════════════════════════════════════════
--   MBBET OS · Migration: Modello "Pocket" per collaboratori (Gas, Ale e Fede)
--   A differenza di Alan (pagato a sito, subito), questi collaboratori
--   accumulano una quota per ogni sito completato di uno stesso cliente
--   dentro un "pocket"; solo quando il pocket arriva a 200 si paga il
--   cliente tutto insieme (200 a Gas, oppure 125 Ale e Fede + 75 Gas).
--   SAFE: usa IF NOT EXISTS, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

-- ── collab: che modello di pagamento usa questo collaboratore ───────
alter table collab add column if not exists modello text default 'FLAT';
-- 'FLAT' = pagato a sito (Alan). 'POCKET' = accumulo verso 200 (Gas, Ale e Fede)

-- ── bonus: stato del pocket per questa riga (sito+cliente), separato
--    da stato_collab per non toccare il comportamento di Alan ────────
alter table bonus add column if not exists pocket_stato text;
-- null = non ancora messo da parte. 'ACCUMULATO' = messo da parte, in attesa
-- che il cliente arrivi a 200. 'PAGATO' = incluso in un pagamento gia' fatto.

-- ── storico dei pagamenti finali (quando un cliente arriva a 200) ────
create table if not exists collab_payout (
  id             bigserial primary key,
  cliente        text not null,
  nome_collab    text not null,
  importo_totale numeric(10,2) not null,
  split_gas      numeric(10,2) not null default 0,
  split_altro    numeric(10,2) not null default 0,
  dettaglio      text,
  created_by     text,
  created_at     timestamptz not null default now()
);

alter table collab_payout enable row level security;
drop policy if exists "anon_all_collab_payout" on collab_payout;
create policy "anon_all_collab_payout" on collab_payout
  for all to anon using (true) with check (true);

-- ── Aggiungi Gas e Ale e Fede come collaboratori modello POCKET ──────
insert into collab (id, nome, tipo, stato, modello, data_inizio)
select 'COLLAB-002','Gas','Individuale','Attiva','POCKET',current_date
where not exists (select 1 from collab where nome='Gas');

insert into collab (id, nome, tipo, stato, modello, data_inizio)
select 'COLLAB-003','Ale e Fede','Individuale','Attiva','POCKET',current_date
where not exists (select 1 from collab where nome='Ale e Fede');

-- ── Listino condiviso Gas / Ale e Fede: 16 siti (14 con quota reale + ────
-- Daznbet e Zonagioco a quota 0, per ora). Rimossi Giocodigitale, Vincitu,
-- Netwin, Betsson, Lottomatica, Planetwin: non li lavoriamo e vederli a
-- 0€ nella tabella confondeva chi ha portato il cliente.
insert into collab_tariffe (nome_collab, bookmaker, prezzo, ordine)
select v.nome_collab, v.bookmaker, v.prezzo, v.ordine from (values
  ('Gas','Betflag SPID',75,1),  ('Ale e Fede','Betflag SPID',75,1),
  ('Gas','Bet365',48,2),        ('Ale e Fede','Bet365',48,2),
  ('Gas','Eurobet',45,3),       ('Ale e Fede','Eurobet',45,3),
  ('Gas','Snai',42,4),          ('Ale e Fede','Snai',42,4),
  ('Gas','Sisal',42,5),         ('Ale e Fede','Sisal',42,5),
  ('Gas','William Hill',36,6),  ('Ale e Fede','William Hill',36,6),
  ('Gas','Goldbet',18,7),       ('Ale e Fede','Goldbet',18,7),
  ('Gas','PokerStars',18,8),    ('Ale e Fede','PokerStars',18,8),
  ('Gas','Quigioco',18,9),      ('Ale e Fede','Quigioco',18,9),
  ('Gas','Eplay24',15,10),      ('Ale e Fede','Eplay24',15,10),
  ('Gas','Stanleybet',16,11),   ('Ale e Fede','Stanleybet',16,11),
  ('Gas','Sunbet',11,12),       ('Ale e Fede','Sunbet',11,12),
  ('Gas','Tombola',9,13),       ('Ale e Fede','Tombola',9,13),
  ('Gas','MyLottery',6,14),     ('Ale e Fede','MyLottery',6,14),
  ('Gas','Daznbet',0,16),       ('Ale e Fede','Daznbet',0,16),
  ('Gas','Zonagioco',0,19),     ('Ale e Fede','Zonagioco',0,19)
) as v(nome_collab,bookmaker,prezzo,ordine)
on conflict (nome_collab, bookmaker) do update set prezzo=excluded.prezzo, ordine=excluded.ordine;

-- ── Rimuovi dal listino i siti che non lavoriamo (se gia' inseriti da ────
-- un run precedente di questa migration)
delete from collab_tariffe
where bookmaker in ('Giocodigitale','Vincitu','Netwin','Betsson','Lottomatica','Planetwin')
  and nome_collab in ('Gas','Ale e Fede');

select 'Migration Collab Pocket completata.' as risultato;
