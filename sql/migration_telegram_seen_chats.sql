-- ═══════════════════════════════════════════════════════════════════
--   MBBET OS · Migration: Telegram — chat viste dal bot
--   Da quando il bot Telegram usa un webhook (per i bottoni "Fatto/
--   Problema" nei messaggi), non si può più usare getUpdates per
--   trovare l'ID dei nuovi gruppi. Questa tabella la sostituisce: il
--   webhook registra qui ogni gruppo/chat che vede, e la pagina Team
--   li legge da qui per "Trova ID gruppi".
--   SAFE: usa IF NOT EXISTS, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

create table if not exists telegram_seen_chats (
  chat_id text primary key,
  titolo text,
  tipo text,
  seen_at timestamptz default now()
);

alter table telegram_seen_chats enable row level security;

drop policy if exists "anon_all_telegram_seen_chats" on telegram_seen_chats;
create policy "anon_all_telegram_seen_chats" on telegram_seen_chats
  for all to anon using (true) with check (true);

-- Backfill del gruppo di Ciro, già trovato prima di passare al webhook,
-- così non sparisce da "Trova ID gruppi" dopo questa migration.
insert into telegram_seen_chats (chat_id, titolo, tipo)
values ('-5463653097', 'NOTIFICHE CIRO❤️‍🔥', 'group')
on conflict (chat_id) do nothing;

select 'Migration Telegram Seen Chats completata.' as risultato;
