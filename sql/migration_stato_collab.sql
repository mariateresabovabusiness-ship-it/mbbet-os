-- ═══════════════════════════════════════════════════════════════════
--   MBBET OS · Migration: Stato Pagamento Collaboratore (condiviso)
--   Prima questo stato (Pagato/In corso/Scaduto...) viveva SOLO nel
--   localStorage del browser di chi lo spuntava — quindi ogni persona
--   e ogni dispositivo vedeva stati diversi per lo stesso cliente.
--   Con questa colonna diventa un dato reale e condiviso nel database.
--   SAFE: usa IF NOT EXISTS, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

alter table bonus add column if not exists stato_collab text;

select 'Migration Stato Collab completata.' as risultato;
