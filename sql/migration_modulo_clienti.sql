-- ═══════════════════════════════════════════════════════════════════
--   CRM MBBET · Migration: Colonne per modulo clienti
--   Aggiunge tutti i campi necessari per import vecchio modulo
--   e per il nuovo modulo online.
--   SAFE: usa ADD COLUMN IF NOT EXISTS
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. COLONNE CONTATTO ──────────────────────────────────────────────
ALTER TABLE clienti
  ADD COLUMN IF NOT EXISTS telefono         text,
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS email_siti       text;

-- ── 2. COLONNE OPERATIVE ─────────────────────────────────────────────
ALTER TABLE clienti
  ADD COLUMN IF NOT EXISTS operatore        text,
  ADD COLUMN IF NOT EXISTS collab           text,
  ADD COLUMN IF NOT EXISTS tipologia        text DEFAULT 'Standard',
  ADD COLUMN IF NOT EXISTS has_spid         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_cc           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_nuovo         boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS mese_onboarding  text;

-- ── 3. SITI GIÀ REGISTRATI ───────────────────────────────────────────
ALTER TABLE clienti
  ADD COLUMN IF NOT EXISTS siti_registrati  jsonb DEFAULT '[]'::jsonb;
-- Formato: ["Bet365", "Snai", "Sisal"]
-- Questi diventano GIÀ_REGISTRATO nelle righe bonus.

-- ── 4. CONSENSO E PRIVACY ────────────────────────────────────────────
ALTER TABLE clienti
  ADD COLUMN IF NOT EXISTS consenso_data    timestamptz,
  ADD COLUMN IF NOT EXISTS consenso_testo   text DEFAULT 'Accetto le condizioni operative ed economiche di MBBET.';

-- ── 5. DOCUMENTI (link Drive, non file) ──────────────────────────────
ALTER TABLE clienti
  ADD COLUMN IF NOT EXISTS doc_ci_fronte    text,   -- Carta d'identità fronte
  ADD COLUMN IF NOT EXISTS doc_ci_retro     text,   -- Carta d'identità retro
  ADD COLUMN IF NOT EXISTS doc_ts_fronte    text,   -- Tessera sanitaria fronte
  ADD COLUMN IF NOT EXISTS doc_ts_retro     text,   -- Tessera sanitaria retro
  ADD COLUMN IF NOT EXISTS doc_foto_fronte  text,   -- Foto con documento fronte
  ADD COLUMN IF NOT EXISTS doc_foto_retro   text,   -- Foto con documento retro
  ADD COLUMN IF NOT EXISTS doc_extra        jsonb DEFAULT '[]'::jsonb;

-- ── 6. TRACCIAMENTO SORGENTE ─────────────────────────────────────────
ALTER TABLE clienti
  ADD COLUMN IF NOT EXISTS source           text DEFAULT 'manuale',
  -- Valori: 'vecchio_modulo' | 'nuovo_modulo' | 'manuale' | 'import'
  ADD COLUMN IF NOT EXISTS import_batch_id  text;

-- ── 7. TIMESTAMPS (se non presenti) ──────────────────────────────────
ALTER TABLE clienti
  ADD COLUMN IF NOT EXISTS created_at       timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz DEFAULT now();

-- ── 8. NUOVA TABELLA: import_log ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_log (
  id              bigserial PRIMARY KEY,
  batch_id        text NOT NULL,
  fonte           text NOT NULL,       -- 'vecchio_modulo_google_form'
  data_import     timestamptz DEFAULT now(),
  eseguito_da     text,
  clienti_letti   integer DEFAULT 0,
  clienti_creati  integer DEFAULT 0,
  clienti_aggiornati integer DEFAULT 0,
  duplicati       integer DEFAULT 0,
  dati_mancanti   integer DEFAULT 0,
  errori          integer DEFAULT 0,
  bonus_creati    integer DEFAULT 0,
  dettaglio       jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE import_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon_all_import_log" ON import_log
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── 9. AGGIORNA RLS clienti (se necessario) ──────────────────────────
-- Se la tabella clienti non ha policy anon, aggiungila:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clienti' AND policyname = 'anon_all_clienti'
  ) THEN
    ALTER TABLE clienti ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY anon_all_clienti ON clienti FOR ALL TO anon USING (true) WITH CHECK (true)';
  END IF;
END$$;

-- ── 10. INDEX ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clienti_telefono ON clienti(telefono);
CREATE INDEX IF NOT EXISTS idx_clienti_email    ON clienti(email);
CREATE INDEX IF NOT EXISTS idx_clienti_operatore ON clienti(operatore);
CREATE INDEX IF NOT EXISTS idx_clienti_source   ON clienti(source);

-- ── VERIFICA ─────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'clienti'
ORDER BY ordinal_position;

SELECT 'Migration modulo clienti completata.' AS risultato;
