-- ═══════════════════════════════════════════════════════════════════
--   CRM MBBET · Migration: mese_operativo + saldo_bk
--   Aggiunge tracking mensile e saldo per filtri finanziari
--   SAFE: usa ADD COLUMN IF NOT EXISTS
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

-- ── NUOVI CAMPI TABELLA BONUS ────────────────────────────────────
alter table bonus
  add column if not exists mese_operativo  smallint,          -- 1-12 (mese di competenza)
  add column if not exists anno_operativo  smallint,          -- es. 2026
  add column if not exists saldo_bk        numeric(10,2) default 0,  -- saldo attuale sul bookmaker
  add column if not exists prossima_azione text;              -- se non già presente come pross_azione

-- ── AUTO-POPULATE: ricava mese/anno da data_inizio dove mancante ─
update bonus
set
  mese_operativo = extract(month from data_inizio)::smallint,
  anno_operativo  = extract(year  from data_inizio)::smallint
where (mese_operativo is null or anno_operativo is null)
  and data_inizio is not null;

-- ── FALLBACK: righe senza data_inizio → mese/anno corrente ───────
update bonus
set
  mese_operativo = extract(month from now())::smallint,
  anno_operativo  = extract(year  from now())::smallint
where mese_operativo is null or anno_operativo is null;

-- ── INDEX per query finance per mese ────────────────────────────
create index if not exists idx_bonus_mese_anno
  on bonus(anno_operativo, mese_operativo);

create index if not exists idx_bonus_op_bk_mese
  on bonus(operatore, bookmaker, anno_operativo, mese_operativo);

-- ── VERIFICA ────────────────────────────────────────────────────
select
  anno_operativo, mese_operativo,
  operatore, bookmaker,
  count(*) as n_pratiche,
  sum(coalesce(prelievo,0) - coalesce(deposito,0)) as guad_tot
from bonus
where anno_operativo is not null
group by anno_operativo, mese_operativo, operatore, bookmaker
order by anno_operativo desc, mese_operativo desc, operatore;

select 'Migration mese_operativo completata.' as risultato;
