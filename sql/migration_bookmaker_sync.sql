-- ═══════════════════════════════════════════════════════════════════
--   ESEGUI QUESTO FILE UNA VOLTA SOLA — Supabase → SQL Editor → RUN
--   Aggiunge colore + ROI stimato ad ogni bookmaker, cosi il CRM Clienti
--   legge la lista bookmaker direttamente dal database invece di averla
--   scritta a mano nel codice — un nuovo bookmaker aggiunto qui comparira
--   automaticamente ovunque nel CRM.
--   SAFE: usa IF NOT EXISTS, riseguibile.
-- ═══════════════════════════════════════════════════════════════════

alter table bookmaker
  add column if not exists colore       text,
  add column if not exists roi_stimato  numeric(5,2);

-- ── Valori esistenti (mantengono esattamente i colori/ROI gia in uso) ─
update bookmaker set colore='#22eeff', roi_stimato=22 where nome='Bet365';
update bookmaker set colore='#5aaaff', roi_stimato=16 where nome='Snai';
update bookmaker set colore='#ff4f4f', roi_stimato=10 where nome='Lottomatica';
update bookmaker set colore='#f7cc46', roi_stimato=14 where nome='Goldbet';
update bookmaker set colore='#00d4b0', roi_stimato=15 where nome='Planetwin';
update bookmaker set colore='#5aaaff', roi_stimato=19 where nome='William Hill';
update bookmaker set colore='#00f093', roi_stimato=24 where nome='Betfair';
update bookmaker set colore='#00b25a', roi_stimato=17 where nome='Paddy Power';
update bookmaker set colore='#c4a4f8', roi_stimato=11 where nome='Unibet';
update bookmaker set colore='#ff6000', roi_stimato=16 where nome='Bwin';
update bookmaker set colore='#f7cc46', roi_stimato=13 where nome='Eurobet';
update bookmaker set colore='#00f093', roi_stimato=18 where nome='Sisal';
update bookmaker set colore='#e60026', roi_stimato=13 where nome='Netbet';
update bookmaker set colore='#00a650', roi_stimato=15 where nome='Betway';
update bookmaker set colore='#ff6600', roi_stimato=14 where nome='888sport';
update bookmaker set colore='#f7cc46', roi_stimato=18 where nome='Betsson';
update bookmaker set colore='#22eeff', roi_stimato=20 where nome='Sportaza';
update bookmaker set colore='#5aaaff', roi_stimato=12 where nome='Admiralbet';
update bookmaker set colore='#c4a4f8', roi_stimato=12 where nome='Vincitu';
update bookmaker set colore='#ff9040', roi_stimato=42 where nome='Betflag';

-- ── Nuovi bookmaker (guide MBBET, aggiunti in questa sessione) ────────
update bookmaker set colore='#00c2ff', roi_stimato=15 where nome='Eplay24';
update bookmaker set colore='#8b5cf6', roi_stimato=14 where nome='Giocodigitale';
update bookmaker set colore='#e2231a', roi_stimato=16 where nome='Pokerstars';
update bookmaker set colore='#ff5e78', roi_stimato=15 where nome='Betpassion';
update bookmaker set colore='#f7c600', roi_stimato=16 where nome='Daznbet';
update bookmaker set colore='#22c55e', roi_stimato=13 where nome='Netwin';
update bookmaker set colore='#ffcc00', roi_stimato=11 where nome='Quigioco';
update bookmaker set colore='#ffaa00', roi_stimato=11 where nome='Sunbet';
update bookmaker set colore='#ff6fae', roi_stimato=10 where nome='Tombola.it';
update bookmaker set colore='#00e5ff', roi_stimato=11 where nome='Zonagioco';
update bookmaker set colore='#3b82f6', roi_stimato=15 where nome='Stanleybet';

-- ── Bookmaker presenti nello schema originale ma mai usati nel CRM
--    (nessun colore/ROI mai assegnato prima) — valori di default per tier
update bookmaker set colore='#ff66cc', roi_stimato=14 where nome='Mrplay';
update bookmaker set colore='#9ca3af', roi_stimato=10 where nome='Begameresponsible';
update bookmaker set colore='#f97316', roi_stimato=11 where nome='Rivalo';
update bookmaker set colore='#84cc16', roi_stimato=10 where nome='Elabet';

-- ── Backfill di sicurezza: qualsiasi bookmaker rimasto senza colore/ROI
--    (es. aggiunto manualmente in futuro) prende un default in base al tier,
--    cosi non resta mai "vuoto" nel CRM.
update bookmaker set colore = case tier
    when 'S+' then '#22eeff' when 'S' then '#5aaaff' when 'A' then '#00f093'
    when 'B' then '#f7cc46' else '#9ca3af' end
  where colore is null;
update bookmaker set roi_stimato = case tier
    when 'S+' then 22 when 'S' then 17 when 'A' then 16
    when 'B' then 14 else 10 end
  where roi_stimato is null;

select 'Migration bookmaker sync completata.' as risultato;
