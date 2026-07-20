-- ═══════════════════════════════════════════════════════════════════
--   MBBET OS · Migration: Bonus "gruppo" extra per collaboratore
--   Alcuni collaboratori hanno un accordo economico separato dal listino
--   a sito: un importo fisso una tantum per ogni cliente portato (oggi
--   Alan, € 20 a cliente). Non è automatico — Mary decide caso per caso
--   quando il cliente ha uno storico sufficiente, poi lo segna pagato
--   da un interruttore in 07_collab.html.
--
--   SAFE: usa IF NOT EXISTS, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

alter table collab add column if not exists bonus_extra_gruppo numeric(10,2);
-- null/0 = nessun accordo di questo tipo per questo collaboratore.
-- Un valore (es. 20) = importo fisso una tantum per cliente portato.

update collab set bonus_extra_gruppo = 20 where nome = 'Alan';

select id, nome, modello, bonus_extra_gruppo from collab order by nome;
