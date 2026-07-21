-- ═══════════════════════════════════════════════════════════════════
--   MBBET OS · Migration: Serena e Nico in "operatori" (solo per Telegram)
--
--   Non li rende assegnabili come operatori di registrazione bonus — è
--   solo la tabella che il sistema usa per sapere a chi mandare notifiche
--   Telegram. Serena è socia (coordina il lavoro), Nico è suo assistente
--   (ruolo OPERATORE_SELF già impostato in utenti_crm) — il campo `ruolo`
--   qui riflette questo, non implica nient'altro.
--
--   SAFE: usa ON CONFLICT sul nome (unique), riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

insert into operatori (id, nome, ruolo, stato)
values ('OP-SERENA', 'Serena', 'Socio', 'Attivo')
on conflict (nome) do nothing;

insert into operatori (id, nome, ruolo, stato)
values ('OP-NICO', 'Nico', 'Assistente', 'Attivo')
on conflict (nome) do nothing;

select id, nome, ruolo, stato, telegram_chat_id from operatori where nome in ('Serena','Nico');
