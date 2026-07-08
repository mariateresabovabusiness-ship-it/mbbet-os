-- ═══════════════════════════════════════════════════════════════════
--   ESEGUI QUESTO FILE UNA VOLTA SOLA — Supabase → SQL Editor → RUN
--   MBBET SOCIAL OS V1 — Fondamenta
--   Aggiunge: motore insight ARIA, lead pre-CRM, Live Control Center,
--   estende social_content_ideas e social_posts per il Content DNA.
--   Riusa (senza modificarle): notifiche, task, log, config.
--   SAFE: IF NOT EXISTS / ON CONFLICT, riseguibile.
-- ═══════════════════════════════════════════════════════════════════

-- ── A. ESTENDI social_content_ideas (Ideas Lab) ─────────────────────
alter table social_content_ideas
  add column if not exists piattaforma text default 'Instagram',
  add column if not exists target       text,
  add column if not exists effort       text default 'medio',
  add column if not exists potenziale   text default 'medio',
  add column if not exists stato        text default 'DA_VALUTARE',
  add column if not exists origine      text default 'piano_editoriale';

-- ── B. ESTENDI social_posts (Content DNA) ───────────────────────────
alter table social_posts
  add column if not exists pillar          text,
  add column if not exists funnel_stage    text,
  add column if not exists hook_type       text,
  add column if not exists cta_type        text,
  add column if not exists durata_stimata  integer,
  add column if not exists potenziale      text,
  add column if not exists risultato       text;

-- ── C. SOCIAL AI INSIGHTS — motore regole ARIA ──────────────────────
create table if not exists social_ai_insights (
  id                bigserial primary key,
  categoria         text not null,              -- OPPORTUNITY/WARNING/ANOMALY/IDEA/GROWTH/CONTENT/COMMUNITY/OPERATIONS
  titolo            text not null,
  descrizione       text,
  motivazione       text,                        -- "perché te lo consiglio", con dati citati
  evidenze          jsonb,
  tipo_dato         text default 'REGOLA_EURISTICA', -- DATO_REALE/REGOLA_EURISTICA/STIMA/DATO_NON_DISPONIBILE
  urgenza           text default 'media',        -- alta/media/bassa
  azione_consigliata text,
  stato             text default 'nuovo',         -- nuovo/accettato/ignorato/task_creato/idea_creata/posticipato
  id_task_creato    text,
  id_idea_creata    uuid,
  created_at        timestamptz default now(),
  risolto_at        timestamptz
);
create index if not exists idx_social_insights_stato on social_ai_insights(stato);

-- ── D. SOCIAL LEADS — ponte pre-CRM (non duplica clienti) ───────────
create table if not exists social_leads (
  id                bigserial primary key,
  piattaforma       text,
  username          text,
  nome              text,
  contenuto_origine text,
  messaggio         text,
  stato             text default 'nuovo',   -- nuovo/contattato/qualificato/convertito/perso
  id_cliente        text references clienti(id) on delete set null,
  note              text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index if not exists idx_social_leads_stato on social_leads(stato);

-- ── E. LIVE CONTROL CENTER ───────────────────────────────────────────
create table if not exists social_live_events (
  id                    bigserial primary key,
  titolo                text not null,
  piattaforma           text default 'Instagram',
  data_evento           date,
  ora_evento            time,
  durata_prevista_min   integer,
  obiettivo             text,
  tema                  text,
  host                  text,
  responsabile          text,
  stato                 text default 'IDEA', -- IDEA/DA_PREPARARE/IN_PREPARAZIONE/PRONTA/PROGRAMMATA/LIVE/COMPLETATA/DA_ANALIZZARE/ANALIZZATA/ARCHIVIATA
  scaletta              text,
  cta                   text,
  link                  text,
  checklist             jsonb,
  risultati             jsonb,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create table if not exists social_live_notes (
  id        bigserial primary key,
  id_live   bigint references social_live_events(id) on delete cascade,
  fase      text default 'pre',  -- pre/durante/post
  tipo      text default 'generale', -- generale/domanda/lead/contenuto_derivato/problema
  nota      text not null,
  created_at timestamptz default now()
);
create index if not exists idx_live_notes_live on social_live_notes(id_live);

-- ── RLS (anon — coerente con tutto il resto dell'app) ───────────────
alter table social_ai_insights enable row level security;
alter table social_leads       enable row level security;
alter table social_live_events enable row level security;
alter table social_live_notes  enable row level security;

drop policy if exists "anon_all_social_ai_insights" on social_ai_insights;
create policy "anon_all_social_ai_insights" on social_ai_insights for all to anon using (true) with check (true);

drop policy if exists "anon_all_social_leads" on social_leads;
create policy "anon_all_social_leads" on social_leads for all to anon using (true) with check (true);

drop policy if exists "anon_all_social_live_events" on social_live_events;
create policy "anon_all_social_live_events" on social_live_events for all to anon using (true) with check (true);

drop policy if exists "anon_all_social_live_notes" on social_live_notes;
create policy "anon_all_social_live_notes" on social_live_notes for all to anon using (true) with check (true);

select 'FATTO — Social OS V1 (fondamenta) installato.' as risultato;
