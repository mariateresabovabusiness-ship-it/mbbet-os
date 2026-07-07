-- ══════════════════════════════════════════════════════════════════
-- MBBET OS — Social Module Tables
-- Eseguire via Management API o SQL Editor Supabase
-- ══════════════════════════════════════════════════════════════════

-- A. SOCIAL POSTS
CREATE TABLE IF NOT EXISTS social_posts (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titolo              text NOT NULL,
  tipo_contenuto      text DEFAULT 'REEL',
  piattaforma         text DEFAULT 'Instagram',
  autore              text,
  assegnato_a         text,
  data_pubblicazione  date,
  stato               text DEFAULT 'IDEA',
  hook                text,
  script              text,
  caption             text,
  cta                 text,
  obiettivo           text,
  livello_rischio     text DEFAULT 'basso',
  parole_rischiose    text[],
  revisione_necessaria boolean DEFAULT false,
  approvato_da        text,
  pubblicato          boolean DEFAULT false,
  metriche            jsonb,
  note                text,
  task_correlati      text[],
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- B. SOCIAL RISK WORDS
CREATE TABLE IF NOT EXISTS social_risk_words (
  id                bigserial PRIMARY KEY,
  parola            text UNIQUE NOT NULL,
  categoria         text,
  livello_rischio   text DEFAULT 'medio',
  alternativa_sicura text,
  note              text,
  attiva            boolean DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

-- C. SOCIAL CONTENT IDEAS (piano editoriale)
CREATE TABLE IF NOT EXISTS social_content_ideas (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titolo          text NOT NULL,
  descrizione     text,
  tipo            text,
  obiettivo       text,
  proposto_da     text,
  approvato       boolean DEFAULT false,
  priorita        text DEFAULT 'media',
  settimana_piano integer,
  created_at      timestamptz DEFAULT now()
);

-- D. SOCIAL AGENTS LOG (Guardian audit trail)
CREATE TABLE IF NOT EXISTS social_agents_log (
  id              bigserial PRIMARY KEY,
  post_id         uuid REFERENCES social_posts(id) ON DELETE SET NULL,
  tipo            text,
  testo_analizzato text,
  parole_trovate  text[],
  rischio_score   integer DEFAULT 0,
  livello_rischio text,
  suggerimenti    jsonb,
  agente          text DEFAULT 'MBBET_GUARDIAN',
  utente          text,
  created_at      timestamptz DEFAULT now()
);

-- E. SOCIAL CALENDAR (scheduling separato)
CREATE TABLE IF NOT EXISTS social_calendar (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id          uuid REFERENCES social_posts(id) ON DELETE CASCADE,
  data_programmata date NOT NULL,
  ora_programmata  time,
  piattaforma      text,
  stato            text DEFAULT 'PROGRAMMATO',
  note             text,
  created_at       timestamptz DEFAULT now()
);

-- ── INDEXES ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_social_posts_data      ON social_posts(data_pubblicazione);
CREATE INDEX IF NOT EXISTS idx_social_posts_stato     ON social_posts(stato);
CREATE INDEX IF NOT EXISTS idx_social_posts_assegnato ON social_posts(assegnato_a);
CREATE INDEX IF NOT EXISTS idx_social_posts_rischio   ON social_posts(livello_rischio);
CREATE INDEX IF NOT EXISTS idx_social_cal_data        ON social_calendar(data_programmata);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_social_posts_updated_at
    BEFORE UPDATE ON social_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE social_posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_risk_words     ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_content_ideas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_agents_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_calendar       ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read/write (role check in app layer)
DO $$ BEGIN
  CREATE POLICY "auth_all_social_posts"
    ON social_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_all_risk_words"
    ON social_risk_words FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_all_content_ideas"
    ON social_content_ideas FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_all_agents_log"
    ON social_agents_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_all_social_cal"
    ON social_calendar FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── SEED: PAROLE RISCHIOSE ────────────────────────────────────────
INSERT INTO social_risk_words (parola, categoria, livello_rischio, alternativa_sicura) VALUES
  ('scommessa',          'gambling',   'alto',  'strategia'),
  ('scommesse',          'gambling',   'alto',  'operazioni'),
  ('scommettere',        'gambling',   'alto',  'operare'),
  ('betting',            'gambling',   'alto',  'metodo operativo'),
  ('vincita sicura',     'promesse',   'alto',  'risultato verificabile'),
  ('guadagno garantito', 'promesse',   'alto',  'percorso strutturato'),
  ('soldi facili',       'promesse',   'alto',  'opportunità di crescita'),
  ('casinò',             'gambling',   'alto',  'piattaforma'),
  ('casino',             'gambling',   'alto',  'piattaforma'),
  ('bonus senza rischio','promesse',   'alto',  'opportunità gestita'),
  ('profitto certo',     'promesse',   'alto',  'margine operativo'),
  ('metodo infallibile', 'promesse',   'alto',  'metodo collaudato'),
  ('gambling',           'gambling',   'alto',  'gestione'),
  ('guadagno facile',    'promesse',   'alto',  'percorso formativo'),
  ('senza rischio',      'promesse',   'alto',  'con metodo'),
  ('fare soldi',         'promesse',   'medio', 'costruire un percorso'),
  ('rendita passiva',    'promesse',   'medio', 'entrata ricorrente'),
  ('bookmaker',          'gambling',   'medio', 'operatore'),
  ('puntata',            'gambling',   'medio', 'operazione'),
  ('puntate',            'gambling',   'medio', 'operazioni'),
  ('bet',                'gambling',   'medio', 'operazione'),
  ('odds',               'gambling',   'basso', 'quota'),
  ('guadagni',           'promesse',   'basso', 'risultati'),
  ('fare soldi',         'promesse',   'medio', 'costruire indipendenza'),
  ('gioco',              'gambling',   'basso', 'procedura'),
  ('gioca',              'gambling',   'basso', 'opera')
ON CONFLICT (parola) DO NOTHING;

-- ── SEED: PIANO EDITORIALE 30gg ───────────────────────────────────
INSERT INTO social_content_ideas (titolo, descrizione, tipo, obiettivo, settimana_piano) VALUES
  ('Chi è MBBET?',                    'Presentazione team e mission',                   'REEL',         'brand_awareness', 1),
  ('Il team MBBET — 4 persone 1 metodo','Presentazione soci e operatori',               'CAROSELLO',    'brand_awareness', 1),
  ('Un giorno con noi',               'Dietro le quinte operatività quotidiana',         'STORIA',       'brand_awareness', 1),
  ('Le domande che ci fanno di più',  'FAQ formato reel senza termini sensibili',        'REEL',         'educazione',      1),
  ('I nostri valori in 3 punti',      'Trasparenza correttezza metodo',                  'POST',         'fiducia',         1),
  ('Come funziona il nostro metodo',  'Spiegazione passo-passo del percorso guidato',   'REEL',         'educazione',      2),
  ('Cosa NON diciamo mai ai clienti', 'Onestà e trasparenza come differenziale',         'POST',         'fiducia',         2),
  ('Il processo di onboarding',       'Come entra un nuovo cliente nel percorso',        'CAROSELLO',    'educazione',      2),
  ('Dietro le quinte dell operatività','Lavoro del team nel quotidiano',                 'STORIA',       'brand_awareness', 2),
  ('Educazione operativa — Ep.1',     'Prima puntata della serie educational',           'EDUCATIONAL',  'educazione',      2),
  ('Caso studio: il percorso guidato','Storia anonimizzata di percorso completo',        'REEL',         'social_proof',    3),
  ('3 errori comuni da evitare',      'Errori che vediamo spesso nel settore',           'CAROSELLO',    'educazione',      3),
  ('Come gestiamo un profilo da zero','Processo operativo spiegato senza termini rischio','REEL',        'educazione',      3),
  ('FAQ puntata 2 — Le vostre domande','Risposte alle domande della community',          'REEL',         'engagement',      3),
  ('Esperienza di un nostro cliente', 'Testimonianza anonima e controllata',             'TESTIMONIANZA','social_proof',    3),
  ('Trasparenza prima di tutto',      'I valori alla base del metodo MBBET',             'POST',         'fiducia',         4),
  ('Perché la formazione è tutto',    'Educational sull importanza del percorso',        'REEL',         'educazione',      4),
  ('Il futuro di MBBET',              'Vision e crescita del progetto',                  'REEL',         'brand_awareness', 4),
  ('Team talk — bilancio del mese',   'Il team racconta la settimana',                   'STORIA',       'brand_awareness', 4),
  ('Grazie alla nostra community',    'Ringraziamento e coinvolgimento follower',         'POST',         'engagement',      4)
ON CONFLICT DO NOTHING;
