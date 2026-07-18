-- ═══════════════════════════════════════════════════════════════════
--   Fix: non si riusciva ad aggiungere Spese in Finanza
--   Causa reale (verificata): alla tabella spese mancano
--   1) la colonna "ricorrente" (mai arrivata/sparita dalla schema cache)
--   2) il valore automatico dell'id (bigserial senza più la sequence
--      collegata, quindi ogni insert falliva per id mancante)
--   SAFE: usa IF NOT EXISTS, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

alter table spese
  add column if not exists ricorrente boolean default false;

create sequence if not exists spese_id_seq owned by spese.id;
select setval('spese_id_seq', coalesce((select max(id) from spese), 0) + 1, false);
alter table spese alter column id set default nextval('spese_id_seq');

NOTIFY pgrst, 'reload schema';

select 'Fix spese completato.' as risultato;
