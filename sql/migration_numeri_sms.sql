-- ═══════════════════════════════════════════════════════════════════
--   MBBET OS · Migration: Gestione centralizzata numeri/SMS
--   Traccia i numeri usati per le registrazioni sui bookmaker (oggi si
--   usa il numero del cliente stesso — questa tabella serve per quando
--   si passa a numeri propri/virtuali, per non perdere il collegamento
--   cliente↔sito↔numero↔codice ricevuto).
--
--   SAFE: usa IF NOT EXISTS, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

create table if not exists numeri_sms (
  id                text primary key,              -- NUM-00001
  numero            text not null,
  fornitore         text,                           -- es. nome del servizio/operatore telefonico
  stato             text not null default 'Libero', -- Libero / In uso / Bloccato / Da riciclare
  operatore         text,                           -- chi lo sta usando ora
  id_cli            text references clienti(id),
  nome_cli          text,
  bookmaker         text,
  codice_ricevuto   text,
  data_assegnazione timestamp,
  scadenza          timestamp,
  note              text,
  created_at        timestamp not null default now(),
  updated_at        timestamp not null default now()
);

alter table numeri_sms enable row level security;
drop policy if exists "authenticated_all_numeri_sms" on numeri_sms;
create policy "authenticated_all_numeri_sms" on numeri_sms
  for all to authenticated using (true) with check (true);

select 'Migration numeri_sms completata.' as risultato;
