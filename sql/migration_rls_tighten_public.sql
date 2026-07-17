-- MBBET OS · Fase 1 (ultimo pezzo) — chiude l'accesso pubblico libero
--
-- Oggi chiunque ha la anon key (pubblica, dentro il codice del sito) può
-- leggere/scrivere/cancellare QUALSIASI riga di clienti/bonus/task/documenti/
-- pagamenti/penali, login o no. Questa migration:
--
-- 1) Su documenti/pagamenti/penali: toglie del tutto l'accesso anon (nessun
--    modulo pubblico li tocca — solo lo staff loggato, già coperto dalle
--    policy "authenticated" scritte in Fase 1).
--
-- 2) Su clienti/bonus/task: i moduli pubblici (10_onboarding_cliente,
--    13_modulo_collab, 05_modulo, form_onboarding) DEVONO ancora poter
--    scrivere senza login — restano scrivibili in INSERT per anon, ma non
--    più leggibili/modificabili/cancellabili liberamente. La lettura che
--    serviva ai moduli per il controllo doppioni e la generazione ID passa
--    da funzioni dedicate (sotto) che restituiscono solo l'informazione
--    minima necessaria, non l'intera riga cliente.
--
-- Sicura da rieseguire più volte.

-- ── Funzioni per i moduli pubblici (bypassano RLS solo per il minimo indispensabile) ──

create or replace function rpc_check_dup_cliente(p_tel text)
returns table(id text, nome text, cognome text, operatore text)
language sql stable security definer
set search_path = public
as $$
  select id, nome, cognome, operatore from clienti
  where tel = p_tel or telefono = p_tel
  limit 1
$$;

create or replace function rpc_next_client_id()
returns text
language sql stable security definer
set search_path = public
as $$
  select 'MBBET-' || lpad((coalesce(max(substring(id from 'MBBET-0*(\d+)')::int), 0) + 1)::text, 3, '0')
  from clienti where id like 'MBBET-%'
$$;

create or replace function rpc_next_bonus_seed()
returns int
language sql stable security definer
set search_path = public
as $$
  select coalesce(max(substring(id from 'BNS-0*(\d+)')::int), 0)
  from bonus where id like 'BNS-%'
$$;

grant execute on function rpc_check_dup_cliente(text) to anon;
grant execute on function rpc_next_client_id() to anon;
grant execute on function rpc_next_bonus_seed() to anon;

-- ── 1) Chiudo del tutto l'anon su documenti/pagamenti/penali ──

drop policy if exists "anon_all_documenti" on documenti;
drop policy if exists "anon_all_pagamenti" on pagamenti;
drop policy if exists "anon_all_penali" on penali;

-- ── 2) clienti/bonus/task: da "tutto libero" a "solo insert" per anon ──

drop policy if exists "anon_all_clienti" on clienti;
drop policy if exists "anon_all_bonus" on bonus;
drop policy if exists "anon_all_task" on task;

do $$ begin
  create policy "anon_insert_clienti" on clienti for insert to anon with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "anon_insert_bonus" on bonus for insert to anon with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "anon_insert_task" on task for insert to anon with check (true);
exception when duplicate_object then null; end $$;

select 'Fix parità authenticated completato.' as risultato;
