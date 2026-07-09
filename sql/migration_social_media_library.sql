-- MBBET Social OS — Libreria Media TikTok (Video/Foto per persona)
-- Crea il bucket di storage privato + la tabella di metadata + le policy
-- necessarie perché l'app (che usa solo la anon key, nessuna Auth reale
-- di Supabase) possa caricare/leggere/eliminare file.

-- 1. Bucket privato (non pubblico: materiale grezzo interno, non pubblicato)
insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', false)
on conflict (id) do nothing;

-- 2. Policy sul bucket per il ruolo anon (stesso modello di fiducia usato
--    da tutte le altre tabelle dell'app: nessuna Auth reale, accesso aperto
--    all'anon key che l'app usa internamente)
create policy "social-media anon select"
on storage.objects for select
to anon
using (bucket_id = 'social-media');

create policy "social-media anon insert"
on storage.objects for insert
to anon
with check (bucket_id = 'social-media');

create policy "social-media anon delete"
on storage.objects for delete
to anon
using (bucket_id = 'social-media');

-- 3. Tabella metadata file
create table if not exists social_media_library (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('VIDEO','FOTO')),
  persona text not null check (persona in ('Mary','Manuele','Samuele','Serena')),
  nome_file text not null,
  storage_path text not null,
  dimensione_kb integer,
  note text,
  caricato_da text,
  created_at timestamptz not null default now()
);

alter table social_media_library enable row level security;

create policy "social_media_library anon all"
on social_media_library for all
to anon
using (true)
with check (true);
