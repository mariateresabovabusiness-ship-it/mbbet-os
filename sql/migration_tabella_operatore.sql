-- ═══════════════════════════════════════════════════════════════════
--   CRM MBBET · Migration: Tabella Operatore (Vista Operativa)
--   Aggiunge i campi operativi alla tabella bonus
--   SAFE: usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════════════

-- ── NUOVI CAMPI TABELLA BONUS ────────────────────────────────────
alter table bonus
  add column if not exists username_bk   text,
  add column if not exists password_bk   text,
  add column if not exists stato_op      text default 'In corso',
  -- Valori: 'In corso' | 'Completato' | 'Problema' | 'Bloccato'
  add column if not exists fase_attuale  text default 'Da iniziare',
  -- Es: 'Registrato', 'Deposito effettuato', 'Bonus ricevuto', 'Prelievo richiesto', 'Completato'
  add column if not exists data_inizio   date,
  add column if not exists deposito      numeric(10,2) default 0,
  add column if not exists bonus_ricevuto numeric(10,2) default 0,
  add column if not exists prelievo      numeric(10,2) default 0,
  add column if not exists alert_msg     text,
  add column if not exists cronologia    jsonb default '[]'::jsonb;

-- ── INDEX ────────────────────────────────────────────────────────
create index if not exists idx_bonus_stato_op on bonus(stato_op);
create index if not exists idx_bonus_bk_op    on bonus(bookmaker, stato_op);

-- ── VERIFICA ────────────────────────────────────────────────────
select column_name, data_type
from information_schema.columns
where table_name = 'bonus'
  and column_name in ('username_bk','password_bk','stato_op','fase_attuale',
                      'data_inizio','deposito','bonus_ricevuto','prelievo',
                      'alert_msg','cronologia')
order by column_name;

select 'Migration tabella operatore completata.' as risultato;
