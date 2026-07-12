-- ═══════════════════════════════════════════════════════════════════
--   MBBET OS · Migration: Capital Allocation (Centro Allocazione Capitale)
--   Aggiunge: distinzione maturato/incassato sui bonus (incassato, data_incasso)
--            + 5 tabelle nuove: allocation_rules, monthly_closures,
--            capital_funds, capital_movements, financial_adjustments
--   SAFE: usa IF NOT EXISTS, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

-- ── BONUS: distinzione tra maturato (FATTO) e incassato (soldi arrivati) ──
alter table bonus
  add column if not exists incassato boolean default false;
alter table bonus
  add column if not exists data_incasso date;

-- ── ALLOCATION RULES (percentuali Tesoreria/Investitori, versionate) ────
create table if not exists allocation_rules (
  id               bigserial primary key,
  tesoreria_pct    numeric(5,2) not null default 20,
  investitori_pct  numeric(5,2) not null default 20,
  valido_da        date not null default current_date,
  created_by       text,
  created_at       timestamptz not null default now()
);

alter table allocation_rules enable row level security;
drop policy if exists "anon_all_allocation_rules" on allocation_rules;
create policy "anon_all_allocation_rules" on allocation_rules
  for all to anon using (true) with check (true);

-- regola iniziale di default (20% / 20%), valida da oggi
insert into allocation_rules (tesoreria_pct, investitori_pct, valido_da, created_by)
select 20, 20, current_date, 'sistema'
where not exists (select 1 from allocation_rules);

-- ── MONTHLY CLOSURES (snapshot congelato di un mese chiuso) ─────────────
-- La sola esistenza di una riga per (mese,anno) significa "mese chiuso".
create table if not exists monthly_closures (
  id                    bigserial primary key,
  mese                  int not null check (mese between 1 and 12),
  anno                  int not null,
  ricavi_maturati       numeric(12,2) not null default 0,
  ricavi_incassati      numeric(12,2) not null default 0,
  pag_cli_tot           numeric(12,2) not null default 0,
  comp_operatori        numeric(12,2) not null default 0,
  comp_collab_referral  numeric(12,2) not null default 0,
  costi_operativi       numeric(12,2) not null default 0,
  altre_uscite          numeric(12,2) not null default 0,
  risultato_operativo   numeric(12,2) not null default 0,
  rettifiche            numeric(12,2) not null default 0,
  importo_distribuibile numeric(12,2) not null default 0,
  tesoreria_pct_usata   numeric(5,2) not null default 0,
  investitori_pct_usata numeric(5,2) not null default 0,
  tesoreria_importo     numeric(12,2) not null default 0,
  investitori_importo   numeric(12,2) not null default 0,
  residuo               numeric(12,2) not null default 0,
  approvato_da          text,
  approvato_il          timestamptz,
  note                  text,
  created_at            timestamptz not null default now(),
  unique (mese, anno)
);

alter table monthly_closures enable row level security;
drop policy if exists "anon_all_monthly_closures" on monthly_closures;
create policy "anon_all_monthly_closures" on monthly_closures
  for all to anon using (true) with check (true);

-- ── CAPITAL FUNDS (i Vault: Tesoreria, Investitori, Operativo, ecc.) ────
create table if not exists capital_funds (
  id                    bigserial primary key,
  nome                  text not null unique,
  tipo                  text,
  obiettivo_importo     numeric(12,2),
  obiettivo_mesi_costi  numeric(5,2),
  saldo_attuale         numeric(12,2) not null default 0,
  created_at            timestamptz not null default now()
);

alter table capital_funds enable row level security;
drop policy if exists "anon_all_capital_funds" on capital_funds;
create policy "anon_all_capital_funds" on capital_funds
  for all to anon using (true) with check (true);

insert into capital_funds (nome, tipo)
select v.nome, v.tipo from (values
  ('Tesoreria','TESORERIA'),
  ('Fondo Investitori','INVESTITORI'),
  ('Operativo','OPERATIVO')
) as v(nome, tipo)
where not exists (select 1 from capital_funds where capital_funds.nome = v.nome);

-- ── CAPITAL MOVEMENTS (storico movimenti di ogni Vault) ──────────────────
create table if not exists capital_movements (
  id           bigserial primary key,
  fund_id      bigint not null references capital_funds(id),
  tipo         text not null check (tipo in ('ACCANTONAMENTO','PRELIEVO','RETTIFICA')),
  importo      numeric(12,2) not null,
  mese         int,
  anno         int,
  closure_id   bigint references monthly_closures(id),
  descrizione  text,
  created_by   text,
  created_at   timestamptz not null default now()
);

alter table capital_movements enable row level security;
drop policy if exists "anon_all_capital_movements" on capital_movements;
create policy "anon_all_capital_movements" on capital_movements
  for all to anon using (true) with check (true);

create index if not exists idx_capital_movements_fund on capital_movements(fund_id);

-- ── FINANCIAL ADJUSTMENTS (rettifiche quando si tocca un mese già chiuso) ─
create table if not exists financial_adjustments (
  id                 bigserial primary key,
  mese_riferimento   int not null,
  anno_riferimento   int not null,
  mese_applicazione  int not null,
  anno_applicazione  int not null,
  importo            numeric(12,2) not null,
  motivo             text,
  tabella_origine    text,
  riga_origine_id    text,
  created_by         text,
  created_at         timestamptz not null default now()
);

alter table financial_adjustments enable row level security;
drop policy if exists "anon_all_financial_adjustments" on financial_adjustments;
create policy "anon_all_financial_adjustments" on financial_adjustments
  for all to anon using (true) with check (true);

select 'Migration Capital Allocation completata.' as risultato;
