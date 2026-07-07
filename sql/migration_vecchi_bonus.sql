-- ═══════════════════════════════════════════════════════════════════
--   CRM MBBET · Migration: Allinea righe vecchie al nuovo workspace
--   Converte vecchi record bonus (stato LIBERO/IN_CORSO/FATTO) al
--   formato nuovo workspace (stato_op, fase_attuale, mese_operativo).
--
--   SAFE: usa COALESCE — non tocca righe già migrate
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. MAPPA stato → stato_op dove stato_op è NULL ──────────────────
UPDATE bonus
SET stato_op = CASE
  WHEN stato = 'IN_CORSO'            THEN 'In corso'
  WHEN stato = 'FATTO'               THEN 'Completato'
  WHEN stato = 'LIMITATO'            THEN 'Problema'
  WHEN stato = 'BANNATO'             THEN 'Problema'
  WHEN stato = 'GIA_REGISTRATO'      THEN 'In corso'
  WHEN stato = 'IN_ATTESA_CLIENTE'   THEN 'In corso'
  WHEN stato = 'DA_VERIFICARE'       THEN 'In corso'
  WHEN stato = 'NON_IDONEO'          THEN 'Bloccato'
  WHEN stato = 'LIBERO'              THEN 'In corso'
  ELSE 'In corso'
END
WHERE stato_op IS NULL;

-- ── 2. IMPOSTA fase_attuale dove è NULL ────────────────────────────
UPDATE bonus
SET fase_attuale = CASE
  WHEN stato = 'FATTO'               THEN 'Completato'
  WHEN stato = 'IN_CORSO'            THEN 'Bonus ricevuto'
  WHEN stato = 'GIA_REGISTRATO'      THEN 'Registrato'
  WHEN stato = 'LIMITATO'            THEN 'Problema'
  WHEN stato = 'BANNATO'             THEN 'Problema'
  ELSE 'Da iniziare'
END
WHERE fase_attuale IS NULL;

-- ── 3. IMPOSTA defaults numerici dove NULL ─────────────────────────
UPDATE bonus
SET
  deposito       = COALESCE(deposito, 0),
  bonus_ricevuto = COALESCE(bonus_ricevuto, 0),
  prelievo       = COALESCE(prelievo, 0),
  costi_extra    = COALESCE(costi_extra, 0),
  perc_op        = COALESCE(perc_op, 20)
WHERE deposito IS NULL OR bonus_ricevuto IS NULL OR prelievo IS NULL;

-- ── 4. RICAVA mese/anno operativo da data_inizio dove mancanti ─────
UPDATE bonus
SET
  mese_operativo = EXTRACT(MONTH FROM data_inizio)::smallint,
  anno_operativo = EXTRACT(YEAR  FROM data_inizio)::smallint
WHERE (mese_operativo IS NULL OR anno_operativo IS NULL)
  AND data_inizio IS NOT NULL;

-- ── 5. FALLBACK: righe senza data_inizio → mese/anno corrente ──────
-- (così compaiono nella tab "mese corrente" invece di sparire)
UPDATE bonus
SET
  data_inizio    = CURRENT_DATE,
  mese_operativo = EXTRACT(MONTH FROM CURRENT_DATE)::smallint,
  anno_operativo = EXTRACT(YEAR  FROM CURRENT_DATE)::smallint
WHERE data_inizio IS NULL
  AND operatore IS NOT NULL
  AND bookmaker IS NOT NULL;

-- ── 6. IMPOSTA cronologia = [] dove NULL ───────────────────────────
UPDATE bonus
SET cronologia = '[]'::jsonb
WHERE cronologia IS NULL;

-- ── 7. AGGIORNA updated_at su tutte le righe migrate ──────────────
UPDATE bonus
SET updated_at = NOW()
WHERE updated_at IS NULL;

-- ── VERIFICA RISULTATO ─────────────────────────────────────────────
SELECT
  stato,
  stato_op,
  fase_attuale,
  COUNT(*) as n_righe,
  COUNT(mese_operativo) as con_mese,
  COUNT(operatore)      as con_operatore,
  COUNT(bookmaker)      as con_bookmaker
FROM bonus
GROUP BY stato, stato_op, fase_attuale
ORDER BY stato, stato_op;

-- ── RIGHE PROBLEMATICHE (senza operatore o bookmaker) ─────────────
-- Queste NON appariranno nel workspace finché non vengono assegnate:
SELECT id, cliente, stato, operatore, bookmaker, data_inizio
FROM bonus
WHERE operatore IS NULL OR operatore = ''
   OR bookmaker IS NULL OR bookmaker = ''
ORDER BY created_at DESC;

SELECT 'Migration vecchi bonus completata.' AS risultato;
