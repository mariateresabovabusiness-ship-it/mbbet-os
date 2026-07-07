-- ═══════════════════════════════════════════════════════════════════
--   CRM MBBET · Migration: promo_bookmaker + Seed URL Bookmaker
--   Incolla nella SQL Editor di Supabase e clicca RUN
--   SAFE: usa IF NOT EXISTS + ON CONFLICT DO NOTHING
-- ═══════════════════════════════════════════════════════════════════

-- ── TABELLA PROMO_BOOKMAKER ───────────────────────────────────────
create table if not exists promo_bookmaker (
  id            bigserial primary key,
  bk_nome       text not null,
  tipo          text not null default 'SD',
  -- SD / RELOAD / CASHBACK / MISSION / BENVENUTO / VIP / RICORRENTE
  titolo        text not null,
  descrizione   text,
  roi_stimato   numeric(5,2) default 0,
  data_fine     text default 'Ricorrente',
  -- 'Ricorrente' oppure data ISO (es. '2026-07-31')
  priorita      text default 'MEDIA',        -- ALTA / MEDIA / BASSA
  stato         text default 'ATTIVA',       -- ATTIVA / SCADUTA / SOSPESA
  note          text,
  created_at    timestamp default now(),
  updated_at    timestamp default now()
);

alter table promo_bookmaker enable row level security;

create policy if not exists "anon_all_promo_bookmaker" on promo_bookmaker
  for all to anon using (true) with check (true);

create index if not exists idx_promo_bk_nome on promo_bookmaker(bk_nome);
create index if not exists idx_promo_stato   on promo_bookmaker(stato);

create trigger trg_promo_updated_at
  before update on promo_bookmaker
  for each row execute function set_updated_at();

-- ── SEED PROMO INIZIALI ────────────────────────────────────────────
insert into promo_bookmaker (bk_nome, tipo, titolo, descrizione, roi_stimato, data_fine, priorita, stato) values
  ('Betfair',       'CASHBACK',   'Cashback 10% Settimanale',       'Cashback sulle perdite nette della settimana. Accreditato il lunedì.',                    24, 'Ricorrente', 'MEDIA', 'ATTIVA'),
  ('Bet365',        'RELOAD',     'Ricarica 50% fino a €100',        '50% sul deposito, min €10. Applicabile ogni settimana.',                                  22, '2026-08-31', 'ALTA',  'ATTIVA'),
  ('William Hill',  'MISSION',    'Mission Settimanale €25',         'Completa 5 scommesse da min €5 per ricevere €25 bonus.',                                  19, 'Ricorrente', 'ALTA',  'ATTIVA'),
  ('Sisal',         'VIP',        'Cashback VIP 5% Mensile',         'Cashback mensile sui volumi clienti VIP. Accredito automatico.',                         18, 'Ricorrente', 'MEDIA', 'ATTIVA'),
  ('Goldbet',       'RELOAD',     'Reload Weekend 30%',              'Ogni weekend: 30% sul deposito fino a €50. Ricorrente.',                                   14, 'Ricorrente', 'BASSA', 'ATTIVA'),
  ('Snai',          'MISSION',    'Bonus Missione Settimanale',       'Completa le missioni settimanali per bonus aggiuntivi. Verificare area promozioni.',      16, 'Ricorrente', 'MEDIA', 'ATTIVA'),
  ('Lottomatica',   'CASHBACK',   'Cashback Sport 5%',               'Cashback 5% sulle scommesse sportive. Accredito mensile.',                                10, 'Ricorrente', 'BASSA', 'ATTIVA'),
  ('Unibet',        'RELOAD',     'Ricarica Lunedì 20%',             'Ogni lunedì: 20% sul deposito fino a €30.',                                               11, 'Ricorrente', 'BASSA', 'ATTIVA'),
  ('Eurobet',       'SD',         'Senza Deposito Speciale €30',     'Bonus senza deposito €30 per nuovi clienti. No wagering.',                                13, '2026-07-31', 'ALTA',  'ATTIVA'),
  ('Bwin',          'BENVENUTO',  'Benvenuto 100% fino a €100',      '100% sul primo deposito. Requisiti standard.',                                            12, '2026-12-31', 'MEDIA', 'ATTIVA')
on conflict do nothing;

-- ── SEED URL BOOKMAKER ────────────────────────────────────────────
-- Aggiorna i link per ogni bookmaker presente nel DB
-- Lascia NULL se non sicuro — gestibile dal pannello Links in 02_bonus.html

update bookmaker set
  link_sito  = 'https://www.bet365.it',
  link_promo = 'https://www.bet365.it/#/PR/'
where nome = 'Bet365';

update bookmaker set
  link_sito  = 'https://www.snai.it',
  link_promo = 'https://www.snai.it/promozioni'
where nome = 'Snai';

update bookmaker set
  link_sito  = 'https://www.lottomatica.it',
  link_promo = 'https://www.lottomatica.it/promozioni'
where nome = 'Lottomatica';

update bookmaker set
  link_sito  = 'https://www.goldbet.it',
  link_promo = 'https://www.goldbet.it/offerte'
where nome = 'Goldbet';

update bookmaker set
  link_sito  = 'https://www.planetwin365.it',
  link_promo = 'https://www.planetwin365.it/it/promo'
where nome = 'Planetwin';

update bookmaker set
  link_sito  = 'https://sports.williamhill.it',
  link_promo = 'https://sports.williamhill.it/promozioni'
where nome = 'William Hill';

update bookmaker set
  link_sito  = 'https://www.betfair.it',
  link_promo = 'https://www.betfair.it/sport/promozioni'
where nome = 'Betfair';

update bookmaker set
  link_sito  = 'https://www.paddypower.it',
  link_promo = 'https://www.paddypower.it/promozioni'
where nome = 'Paddy Power';

update bookmaker set
  link_sito  = 'https://www.unibet.it',
  link_promo = 'https://www.unibet.it/promozioni'
where nome = 'Unibet';

update bookmaker set
  link_sito  = 'https://sports.bwin.it',
  link_promo = 'https://sports.bwin.it/it/sports/promozioni'
where nome = 'Bwin';

update bookmaker set
  link_sito  = 'https://www.eurobet.it',
  link_promo = 'https://www.eurobet.it/it/scommesse/promozioni'
where nome = 'Eurobet';

update bookmaker set
  link_sito  = 'https://www.sisal.it',
  link_promo = 'https://www.sisal.it/scommesse-sportive/promo'
where nome = 'Sisal';

update bookmaker set
  link_sito  = 'https://www.netbet.it',
  link_promo = 'https://www.netbet.it/promotions'
where nome = 'Netbet';

update bookmaker set
  link_sito  = 'https://www.betway.com/it',
  link_promo = 'https://www.betway.com/it/sports/promotions'
where nome = 'Betway';

update bookmaker set
  link_sito  = 'https://www.888sport.it',
  link_promo = 'https://www.888sport.it/promozioni'
where nome = '888sport';

update bookmaker set
  link_sito  = 'https://www.betsson.it',
  link_promo = 'https://www.betsson.it/promozioni'
where nome = 'Betsson';

update bookmaker set
  link_sito  = 'https://www.admiralbet.it',
  link_promo = 'https://www.admiralbet.it/sport/promotions'
where nome = 'Admiralbet';

-- ── VERIFICA ─────────────────────────────────────────────────────
select nome, tier, link_sito is not null as ha_sito, link_promo is not null as ha_promo
from bookmaker
order by priorita_num;

select count(*) as promo_totali, stato from promo_bookmaker group by stato;

select 'Migration promo_bookmaker completata.' as risultato;
