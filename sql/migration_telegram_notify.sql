-- ═══════════════════════════════════════════════════════════════════
--   MBBET OS · Migration: Notifiche Telegram per Operatore
--   Aggiunge il campo dove salvare l'ID della chat/gruppo Telegram di
--   ogni operatore, usato dal bot per avvisarlo quando gli viene
--   assegnato un nuovo sito (da Vista Operativa o da Collaboratori).
--   SAFE: usa IF NOT EXISTS, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

alter table operatori add column if not exists telegram_chat_id text;

select 'Migration Telegram Notify completata.' as risultato;
