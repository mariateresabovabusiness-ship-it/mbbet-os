-- ═══════════════════════════════════════════════════════════════════
--   MBBET OS · Migration: chi avvisare quando un operatore con accesso
--   limitato (es. Nico, scope Sunbet/Goldbet) completa un sito
--
--   Sostituisce l'avviso manuale su WhatsApp: appena l'operatore segna
--   "Fatto" (da 02_bonus.html o dal bottone Telegram), il destinatario
--   configurato qui riceve un messaggio Telegram automatico.
--   Cambia solo questo valore se in futuro deve avvisare qualcun altro.
--
--   SAFE: usa ON CONFLICT, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

insert into config (chiave, valore)
values ('Notifica completamento operatore limitato', 'Serena')
on conflict (chiave) do nothing;

select * from config where chiave = 'Notifica completamento operatore limitato';
