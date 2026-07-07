-- ═══════════════════════════════════════════════════════════════════
--   CRM MBBET · Schema Database Supabase (PostgreSQL)
--   Incolla questo nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

-- ── Estensioni ────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── CLIENTI ───────────────────────────────────────────────────────
create table if not exists clienti (
  id            text primary key,                    -- MBBET-001
  nome          text not null,
  tel           text,
  email         text,
  email_siti    text,
  operatore     text,
  referral      text,
  tipologia     text default 'Organico',
  spid          boolean default false,
  cc            boolean default false,
  data_ingresso date default current_date,
  stato         text default 'ATTIVO',
  drive_url     text,
  collab        text,
  data_acc      timestamp,
  stato_acc     text default 'In Attesa',
  penale_att    boolean default false,
  gg_ritardo    int default 0,
  tot_penale    numeric(10,2) default 0,
  data_prima_op date,
  mese          text,
  tipologia_cli text default 'Nuovo',
  note          text,
  created_at    timestamp default now(),
  updated_at    timestamp default now()
);

-- ── BONUS ─────────────────────────────────────────────────────────
create table if not exists bonus (
  id            text primary key,                    -- BNS-00001
  id_cli        text references clienti(id),
  cliente       text,
  bookmaker     text not null,
  tier          text default 'B',
  stato         text default 'LIBERO',
  operatore     text,
  perc_op       numeric(5,2) default 20,
  referral      text,
  ric_prev      numeric(10,2) default 0,
  ric_real      numeric(10,2) default 0,
  pag_cli       numeric(10,2) default 0,
  costi_extra   numeric(10,2) default 0,
  data_apertura date default current_date,
  ult_azione    timestamp,
  pross_azione  text,
  priorita      text default 'MEDIA',
  note          text,
  id_collab     text,
  nome_collab   text,
  perc_collab   numeric(5,2) default 0,
  created_at    timestamp default now(),
  updated_at    timestamp default now()
);

-- Colonne calcolate come view
create or replace view bonus_view as
select
  b.*,
  round(b.ric_real * b.perc_op / 100, 2)                              as comp_op,
  round(b.ric_real * coalesce(b.perc_collab,0) / 100, 2)             as comp_collab,
  round(b.ric_real - b.pag_cli
        - round(b.ric_real * b.perc_op / 100, 2)
        - round(b.ric_real * coalesce(b.perc_collab,0) / 100, 2)
        - b.costi_extra, 2)                                           as margine
from bonus b;

-- ── COLLAB ────────────────────────────────────────────────────────
create table if not exists collab (
  id            text primary key,                    -- CLB-001
  nome          text not null,
  contatto      text,
  tipo          text default 'Individuale',
  op_rif        text,
  perc          numeric(5,2) default 15,
  stato         text default 'Attiva',
  data_inizio   date default current_date,
  note          text,
  created_at    timestamp default now()
);

-- ── PAGAMENTI ─────────────────────────────────────────────────────
create table if not exists pagamenti (
  id            text primary key,                    -- PAG-0001
  data_pag      timestamp default now(),
  id_cli        text,
  nome_cli      text,
  tipo          text,                               -- Cliente/Operatore/Referral/Collab/Penale/Altro
  beneficiario  text,
  importo       numeric(10,2) not null,
  metodo        text default 'Bonifico',
  causale       text,
  stato         text default 'Pagato',
  created_at    timestamp default now()
);

-- ── PENALI ────────────────────────────────────────────────────────
create table if not exists penali (
  id            text primary key,                    -- PEN-0001
  id_cli        text references clienti(id),
  nome_cli      text,
  operatore     text,
  data_acc      timestamp,
  scad_48h      timestamp,
  data_inizio   date,
  data_fine     date,
  gg_ritardo    int default 0,
  penale_gg     numeric(6,2) default 10,
  tot_penale    numeric(10,2) default 0,
  stato         text default 'In Calcolo',
  ult_aggiorn   timestamp default now(),
  created_at    timestamp default now()
);

-- ── TASK ──────────────────────────────────────────────────────────
create table if not exists task (
  id            text primary key,                    -- TSK-00001
  priorita      text default 'MEDIA',
  tipo          text,
  id_cli        text,
  nome_cli      text,
  operatore     text,
  descrizione   text,
  scadenza      timestamp,
  stato         text default 'Aperto',
  data_creazione timestamp default now(),
  note          text
);

-- ── DOCUMENTI ─────────────────────────────────────────────────────
create table if not exists documenti (
  id            text primary key,                    -- DOC-00001
  id_cli        text references clienti(id),
  nome_cli      text,
  tipo          text,                               -- CI_FRONTE/CI_RETRO/TS_FRONTE/ecc
  drive_url     text,
  data_upload   timestamp default now(),
  operatore     text,
  note          text
);

-- ── LOG ───────────────────────────────────────────────────────────
create table if not exists log (
  id            bigserial primary key,
  ts            timestamp default now(),
  tipo          text,
  id_ref        text,
  nome_ref      text,
  dettaglio     text,
  esito         text,
  errore        text
);

-- ── CONFIG ────────────────────────────────────────────────────────
create table if not exists config (
  chiave        text primary key,
  valore        text
);

insert into config (chiave, valore) values
  ('Email notifiche 1',     'mariateresabova.business@gmail.com'),
  ('Email notifiche 2',     'ponzios71@gmail.com'),
  ('% Manu',                '20'),
  ('% Sere',                '25'),
  ('% Samu',                '20'),
  ('% Mary',                '25'),
  ('Penale €/giorno',       '10'),
  ('Ore prima operazione',  '48'),
  ('Giorni fermo warning',  '7'),
  ('Giorni fermo urgente',  '14'),
  ('Drive root folder',     'CRM MBBET - Documenti Clienti'),
  ('CRM versione',          '3.0')
on conflict (chiave) do nothing;

-- ── BOOKMAKER (tabella lookup) ────────────────────────────────────
create table if not exists bookmaker (
  nome          text primary key,
  tier          text default 'B',
  attivo        boolean default true,
  note          text
);

insert into bookmaker (nome, tier) values
  ('Bet365',          'S+'),
  ('Snai',            'S+'),
  ('Lottomatica',     'S'),
  ('Goldbet',         'S'),
  ('Planetwin',       'S'),
  ('William Hill',    'S'),
  ('Betfair',         'A'),
  ('Paddy Power',     'A'),
  ('Unibet',          'A'),
  ('Bwin',            'A'),
  ('Eurobet',         'A'),
  ('Sisal',           'A'),
  ('Netbet',          'B'),
  ('Betway',          'B'),
  ('888sport',        'B'),
  ('Betsson',         'B'),
  ('Sportaza',        'B'),
  ('Mrplay',          'B'),
  ('Admiralbet',      'B'),
  ('Begameresponsible','C'),
  ('Rivalo',          'C'),
  ('Elabet',          'C')
on conflict (nome) do nothing;

-- ── Indici per performance ─────────────────────────────────────────
create index if not exists idx_bonus_id_cli    on bonus(id_cli);
create index if not exists idx_bonus_stato     on bonus(stato);
create index if not exists idx_task_stato      on task(stato);
create index if not exists idx_task_operatore  on task(operatore);
create index if not exists idx_penali_id_cli   on penali(id_cli);
create index if not exists idx_penali_stato    on penali(stato);
create index if not exists idx_pagamenti_tipo  on pagamenti(tipo);
create index if not exists idx_log_ts          on log(ts desc);

-- ── Row Level Security (tutti leggono/scrivono con anon key) ──────
alter table clienti    enable row level security;
alter table bonus      enable row level security;
alter table collab     enable row level security;
alter table pagamenti  enable row level security;
alter table penali     enable row level security;
alter table task       enable row level security;
alter table documenti  enable row level security;
alter table log        enable row level security;
alter table config     enable row level security;
alter table bookmaker  enable row level security;

-- Policy: accesso completo con anon key (solo uso interno)
do $$
declare
  tbl text;
begin
  foreach tbl in array array['clienti','bonus','collab','pagamenti','penali','task','documenti','log','config','bookmaker']
  loop
    execute format('
      create policy if not exists "anon_all_%s" on %s
      for all to anon using (true) with check (true)', tbl, tbl);
  end loop;
end $$;

-- ── Funzione updated_at automatico ───────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_clienti_updated_at
  before update on clienti
  for each row execute function set_updated_at();

create trigger trg_bonus_updated_at
  before update on bonus
  for each row execute function set_updated_at();

-- ── Done ──────────────────────────────────────────────────────────
select 'Schema CRM MBBET creato con successo! 🎯' as risultato;
