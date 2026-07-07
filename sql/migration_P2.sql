-- ═══════════════════════════════════════════════════════════════════
--   CRM MBBET · Migration P2 — Database Completo
--   Data: 2026-07-01
--   Autore: Sistema CRM MBBET v3.0
--
--   SAFE: usa IF NOT EXISTS + ON CONFLICT DO NOTHING
--   Non rompe nulla di esistente.
--   Rollback incluso in fondo (commentato).
-- ═══════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
-- PARTE A — NUOVE TABELLE
-- ════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- A1. OPERATORI
-- Persone che lavorano operativamente con i clienti.
-- Separato da team_mbbet (che gestisce equity/quote societarie).
-- Un socio compare qui ANCHE come operatore, ma sono entità distinte.
-- ────────────────────────────────────────────────────────────────────
create table if not exists operatori (
  id              text primary key,               -- OP-001
  nome            text not null unique,            -- usato come chiave nei testi
  email           text,
  tel             text,
  ruolo           text default 'Operatore',        -- Socio / Operatore / Esterno
  id_socio        text,                            -- riferimento a team_mbbet.id (soft link)
  perc_default    numeric(5,2) default 20,         -- % operativa di default sui bonus
  colore          text default '#f59e0b',          -- colore UI per grafici e badge
  stato           text default 'Attivo',           -- Attivo / Sospeso / Rimosso
  note            text,
  created_at      timestamp default now()
);

comment on table operatori is
  'Persone operative MBBET. Soci e operatori esterni. Chiave: nome (testo unico).';
comment on column operatori.id_socio is
  'Soft reference a team_mbbet.id. NULL se non è socio.';
comment on column operatori.perc_default is
  'Percentuale operativa predefinita applicata ai bonus di questo operatore.';

-- ────────────────────────────────────────────────────────────────────
-- A2. REFERRAL
-- Persone che portano nuovi clienti a MBBET.
-- Tipo: Esterno (chi non è cliente) o Cliente (già nel CRM).
-- ────────────────────────────────────────────────────────────────────
create table if not exists referral (
  id                  text primary key,            -- REF-001
  nome                text not null,
  tel                 text,
  email               text,
  tipo                text default 'Esterno',      -- Esterno / Cliente
  id_cli              text references clienti(id) on delete set null,
  perc_referral       numeric(5,2) default 5,      -- % applicata sul guadagno MBBET
  n_clienti_portati   int default 0,               -- contatore aggiornato automaticamente
  ricavo_generato     numeric(10,2) default 0,     -- somma ricavi da clienti portati
  comp_maturato       numeric(10,2) default 0,     -- totale compensi maturati
  saldo_da_pagare     numeric(10,2) default 0,     -- ancora da pagare
  saldo_pagato        numeric(10,2) default 0,     -- già pagato
  stato               text default 'Attivo',       -- Attivo / Inattivo / Sospeso
  note                text,
  created_at          timestamp default now(),
  updated_at          timestamp default now()
);

comment on table referral is
  'Chi porta nuovi clienti a MBBET. Traccia ricavi e compensi.';
comment on column referral.tipo is
  'Esterno = persona non nel CRM. Cliente = già in tabella clienti.';

-- ────────────────────────────────────────────────────────────────────
-- A3. NOTIFICHE
-- Centro notifiche interno. Alimentato da trigger automatici e dal CRM.
-- Ogni alert, scadenza, pagamento mancante genera una notifica qui.
-- ────────────────────────────────────────────────────────────────────
create table if not exists notifiche (
  id              bigserial primary key,
  tipo            text not null,                   -- Alert / Task / Penale / Pagamento / Info / Sistema
  titolo          text not null,
  messaggio       text,
  id_ref          text,                            -- id entità correlata (es. TSK-00001)
  tipo_ref        text,                            -- clienti / bonus / task / penali / pagamenti / penali
  destinatario    text,                            -- nome operatore (null = broadcast a tutti)
  priorita        text default 'Media',            -- Alta / Media / Bassa
  letto           boolean default false,
  letto_at        timestamp,
  created_at      timestamp default now()
);

comment on table notifiche is
  'Centro notifiche interno CRM. Ogni evento importante genera una riga qui.';
comment on column notifiche.destinatario is
  'NULL = visibile a tutti. Altrimenti solo all''operatore indicato.';

-- ════════════════════════════════════════════════════════════════════
-- PARTE B — COLONNE AGGIUNTIVE SU TABELLE ESISTENTI
-- Tutte con IF NOT EXISTS — non toccano dati già presenti.
-- ════════════════════════════════════════════════════════════════════

-- ── clienti: foto, score cliente, link referral ──────────────────────
alter table clienti
  add column if not exists id_referral  text references referral(id) on delete set null,
  add column if not exists foto_url     text,
  add column if not exists score        int default 0 check (score >= 0 and score <= 100);

comment on column clienti.id_referral is
  'Chi ha referralato questo cliente. FK su referral.id.';
comment on column clienti.score is
  'Score automatico 0-100 (calcolato da puntualità, bonus, penali, attività).';

-- ── bonus: link referral e compenso referral calcolato ───────────────
alter table bonus
  add column if not exists id_referral    text references referral(id) on delete set null,
  add column if not exists perc_referral  numeric(5,2) default 0,
  add column if not exists comp_referral  numeric(10,2) default 0;

comment on column bonus.id_referral is
  'Referral associato a questo bonus (ereditato dal cliente se presente).';
comment on column bonus.comp_referral is
  'Compenso referral calcolato: ric_real * perc_referral / 100.';

-- ── etica_economica: link referral, comp_referral già presente come colonna ─
alter table etica_economica
  add column if not exists id_referral        text references referral(id) on delete set null,
  add column if not exists comp_referral_calc numeric(10,2) default 0;

-- ── clienti_inattivi: aggiungi link a referral se mancante ───────────
alter table clienti_inattivi
  add column if not exists id_referral text references referral(id) on delete set null;

-- ── pagamenti: link a referral per pagamenti compenso ────────────────
alter table pagamenti
  add column if not exists id_referral text references referral(id) on delete set null;

-- ════════════════════════════════════════════════════════════════════
-- PARTE C — INDICI PER PERFORMANCE
-- ════════════════════════════════════════════════════════════════════

create index if not exists idx_operatori_nome       on operatori(nome);
create index if not exists idx_operatori_stato      on operatori(stato);
create index if not exists idx_referral_stato       on referral(stato);
create index if not exists idx_referral_id_cli      on referral(id_cli);
create index if not exists idx_notifiche_dest       on notifiche(destinatario);
create index if not exists idx_notifiche_letto      on notifiche(letto);
create index if not exists idx_notifiche_created    on notifiche(created_at desc);
create index if not exists idx_notifiche_tipo       on notifiche(tipo);
create index if not exists idx_clienti_id_referral  on clienti(id_referral);
create index if not exists idx_bonus_id_referral    on bonus(id_referral);

-- ════════════════════════════════════════════════════════════════════
-- PARTE D — TRIGGER updated_at SU NUOVE TABELLE
-- La funzione set_updated_at() esiste già dallo schema originale.
-- ════════════════════════════════════════════════════════════════════

create trigger trg_referral_updated_at
  before update on referral
  for each row execute function set_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- PARTE E — ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════

alter table operatori  enable row level security;
alter table referral   enable row level security;
alter table notifiche  enable row level security;

-- Policy accesso completo con anon key (uso interno, rete privata)
do $$
declare tbl text;
begin
  foreach tbl in array array['operatori','referral','notifiche']
  loop
    execute format(
      'create policy if not exists "anon_all_%s" on %s
       for all to anon using (true) with check (true)',
      tbl, tbl
    );
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- PARTE F — SEED DATI INIZIALI
-- I 4 soci MBBET inseriti sia in team_mbbet che in operatori.
-- on conflict do nothing = sicuro da eseguire più volte.
-- ════════════════════════════════════════════════════════════════════

-- Soci in team_mbbet
insert into team_mbbet
  (id, nome, ruolo, tipo, perc_societaria, perc_operativa, stato)
values
  ('SOCIO-001', 'Mary',     'Co-Founder & Operatrice', 'Socio', 25.00, 25.00, 'Attivo'),
  ('SOCIO-002', 'Manuele',  'Co-Founder & Operatore',  'Socio', 25.00, 20.00, 'Attivo'),
  ('SOCIO-003', 'Serena',   'Co-Founder & Operatrice', 'Socio', 25.00, 25.00, 'Attivo'),
  ('SOCIO-004', 'Samuele',  'Co-Founder & Operatore',  'Socio', 25.00, 20.00, 'Attivo')
on conflict (id) do nothing;

-- Stessi 4 in tabella operatori (livello operativo)
insert into operatori
  (id, nome, email, ruolo, id_socio, perc_default, colore, stato)
values
  ('OP-001', 'Mary',    null, 'Socio', 'SOCIO-001', 25.00, '#f59e0b', 'Attivo'),
  ('OP-002', 'Manuele', null, 'Socio', 'SOCIO-002', 20.00, '#3b82f6', 'Attivo'),
  ('OP-003', 'Serena',  null, 'Socio', 'SOCIO-003', 25.00, '#a78bfa', 'Attivo'),
  ('OP-004', 'Samuele', null, 'Socio', 'SOCIO-004', 20.00, '#10b981', 'Attivo')
on conflict (id) do nothing;

-- Config aggiuntiva sistema
insert into config (chiave, valore) values
  ('perc_referral_default',       '5'),
  ('score_soglia_vip',            '80'),
  ('score_soglia_warning',        '40'),
  ('timer_48h_attivo',            'true'),
  ('alert_fermo_gg_giallo',       '7'),
  ('alert_fermo_gg_arancio',      '14'),
  ('alert_fermo_gg_rosso',        '30'),
  ('notifiche_attive',            'true'),
  ('backup_automatico',           'true')
on conflict (chiave) do nothing;

-- Notifica di benvenuto sistema
insert into notifiche (tipo, titolo, messaggio, priorita, destinatario)
values (
  'Sistema',
  'Migration P2 completata',
  'Database CRM MBBET aggiornato: tabelle operatori, referral, notifiche create. Seed soci inseriti.',
  'Bassa',
  null
);

-- ════════════════════════════════════════════════════════════════════
-- VERIFICA FINALE
-- ════════════════════════════════════════════════════════════════════

select
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
from pg_tables
where schemaname = 'public'
  and tablename in (
    'clienti','bonus','collab','pagamenti','penali','task',
    'team_mbbet','clienti_inattivi','etica_economica','ideas_engine',
    'config','bookmaker','documenti','log',
    'operatori','referral','notifiche'
  )
order by tablename;

-- ════════════════════════════════════════════════════════════════════
-- ROLLBACK — Eseguire solo in caso di emergenza
-- Incolla nella SQL Editor e rimuovi i commenti.
-- ════════════════════════════════════════════════════════════════════
/*
-- Step 1: rimuovi indici nuovi
drop index if exists idx_operatori_nome;
drop index if exists idx_operatori_stato;
drop index if exists idx_referral_stato;
drop index if exists idx_referral_id_cli;
drop index if exists idx_notifiche_dest;
drop index if exists idx_notifiche_letto;
drop index if exists idx_notifiche_created;
drop index if exists idx_notifiche_tipo;
drop index if exists idx_clienti_id_referral;
drop index if exists idx_bonus_id_referral;

-- Step 2: rimuovi colonne aggiunte
alter table clienti         drop column if exists id_referral;
alter table clienti         drop column if exists foto_url;
alter table clienti         drop column if exists score;
alter table bonus           drop column if exists id_referral;
alter table bonus           drop column if exists perc_referral;
alter table bonus           drop column if exists comp_referral;
alter table etica_economica drop column if exists id_referral;
alter table etica_economica drop column if exists comp_referral_calc;
alter table clienti_inattivi drop column if exists id_referral;
alter table pagamenti       drop column if exists id_referral;

-- Step 3: rimuovi trigger
drop trigger if exists trg_referral_updated_at on referral;

-- Step 4: rimuovi tabelle nuove (ordine inverso per le FK)
drop table if exists notifiche;
drop table if exists referral;
drop table if exists operatori;
*/

select 'Migration P2 completata correttamente.' as risultato;
