-- ═══════════════════════════════════════════════════════════════════
--   CRM MBBET · Migration: Categorie Finanza (Spese ricorrenti + Entrate Extra)
--   Aggiunge: flag "ricorrente" alle spese (per abbonamenti/costi fissi)
--            + tabella entrate_extra (incassi non legati a un bonus cliente:
--            referral, consulenze, rimborsi, ecc.)
--   SAFE: usa IF NOT EXISTS, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

-- ── SPESE: flag ricorrente (abbonamenti/costi fissi mensili) ────────
alter table spese
  add column if not exists ricorrente boolean default false;

-- ── ENTRATE EXTRA (incassi non legati a un bonus cliente) ───────────
create table if not exists entrate_extra (
  id            bigserial primary key,
  descrizione   text not null,
  categoria     text default 'Altro',
  importo       numeric(10,2) not null,
  data          date default current_date,
  created_at    timestamp default now()
);

alter table entrate_extra enable row level security;

drop policy if exists "anon_all_entrate_extra" on entrate_extra;
create policy "anon_all_entrate_extra" on entrate_extra
  for all to anon using (true) with check (true);

create index if not exists idx_entrate_extra_data on entrate_extra(data);

-- ── SICUREZZA: ricrea la policy anon su "config" (usata ora per salvare le
-- impostazioni Tasse) con sintassi corretta — la versione originale nello
-- schema iniziale usava "create policy if not exists" che non è valido in
-- PostgreSQL e potrebbe non essere mai stata creata davvero.
alter table config enable row level security;
drop policy if exists "anon_all_config" on config;
create policy "anon_all_config" on config
  for all to anon using (true) with check (true);

select 'Migration finanza categorie completata.' as risultato;
