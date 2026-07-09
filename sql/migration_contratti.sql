-- MBBET OS — Sezione Contratti (Versione 1, manuale)
-- Bucket storage per i PDF firmati + tabella contratti.
-- Il bucket va creato dalla dashboard Storage (Nome: contratti, Privato) —
-- l'insert diretto via SQL su storage.buckets non basta a renderlo
-- visibile all'anon key, esattamente come per il bucket "social-media".
-- Questa SQL crea solo le POLICY sul bucket (dopo che l'hai creato a mano)
-- e la tabella contratti.

-- 1. Policy sul bucket "contratti" per il ruolo anon
create policy "contratti anon select bucket"
on storage.buckets for select
to anon
using (id = 'contratti');

create policy "contratti anon select objects"
on storage.objects for select
to anon
using (bucket_id = 'contratti');

create policy "contratti anon insert objects"
on storage.objects for insert
to anon
with check (bucket_id = 'contratti');

create policy "contratti anon delete objects"
on storage.objects for delete
to anon
using (bucket_id = 'contratti');

-- 2. Tabella contratti
create table if not exists contratti (
  id uuid primary key default gen_random_uuid(),
  cliente_id text,
  nome_cliente text not null,
  email_cliente text,
  tipo_contratto text,
  stato text not null default 'DA_INVIARE' check (stato in (
    'DA_INVIARE','INVIATO','IN_ATTESA_FIRMA','FIRMATO','RIFIUTATO','SCADUTO','ERRORE'
  )),
  data_invio date,
  data_firma date,
  link_contratto text,
  storage_path_firmato text,
  provider_esterno text default 'YOUSIGN',
  yousign_request_id text,
  note text,
  operatore text,
  log_eventi jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table contratti enable row level security;

create policy "contratti anon all"
on contratti for all
to anon
using (true)
with check (true);
