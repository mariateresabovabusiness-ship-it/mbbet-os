-- ═══════════════════════════════════════════════════════════════════
--   CRM MBBET · Migration: Colonne link/guida bookmaker + nuovi bookmaker
--   Le colonne link_sito/link_promo/link_guida/link_drive/note_operative/
--   priorita_num sono già usate da 02_bonus.html ma non risultavano
--   create da nessuna migration del repo — questo script le aggiunge.
--   SAFE: usa ADD COLUMN IF NOT EXISTS + ON CONFLICT DO NOTHING
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

-- ── NUOVE COLONNE TABELLA BOOKMAKER ───────────────────────────────
alter table bookmaker
  add column if not exists link_sito       text,
  add column if not exists link_promo      text,
  add column if not exists link_guida      text,   -- URL Google Docs (facoltativo)
  add column if not exists link_drive      text,
  add column if not exists note_operative  text,
  add column if not exists aggiornato_il   timestamp,
  add column if not exists priorita_num    int;

-- ── NUOVI BOOKMAKER (guida MBBET presente ma non ancora in tabella) ─
-- Tier assegnato come default prudente 'B'/'C' — da rivedere manualmente
insert into bookmaker (nome, tier, attivo, note) values
  ('Betflag',       'B', true, null),
  ('Eplay24',       'B', true, null),
  ('Giocodigitale', 'B', true, null),
  ('Pokerstars',    'B', true, null),
  ('Betpassion',    'B', true, null),
  ('Daznbet',       'B', true, null),
  ('Netwin',        'B', true, null),
  ('Quigioco',      'C', true, null),
  ('Sunbet',        'C', true, null),
  ('Tombola.it',    'C', true, null),
  ('Vincitu',       'B', true, null),
  ('Zonagioco',     'C', true, null),
  ('Stanleybet',    'B', true, null)
on conflict (nome) do nothing;

-- ── BACKFILL priorita_num dove mancante (per tutti, vecchi + nuovi) ─
update bookmaker set priorita_num = case tier
  when 'S+' then 1
  when 'S'  then 2
  when 'A'  then 3
  when 'B'  then 4
  when 'C'  then 5
  else 6
end
where priorita_num is null;

-- ── VERIFICA ───────────────────────────────────────────────────────
select nome, tier, priorita_num, attivo,
       link_sito is not null  as ha_sito,
       link_guida is not null as ha_guida_link
from bookmaker
order by priorita_num, nome;

select 'Migration bookmaker guide completata.' as risultato;
