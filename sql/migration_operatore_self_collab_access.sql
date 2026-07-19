-- ═══════════════════════════════════════════════════════════════════
--   Fase 2 · Estensione OPERATORE_SELF — accesso alla Collaboratori
--
--   Nico deve vedere anche la sezione Collaboratori per intero (non solo
--   Sunbet/Goldbet). La pagina però mostra i dati "bonus" incrociati coi
--   collaboratori (siti, accumulato) — allargo quindi la sua visibilità
--   su bonus/clienti anche alle righe legate a un collaboratore,
--   mantenendo comunque la restrizione ai soli Sunbet/Goldbet per tutto
--   il resto (pagina Bonus & BK Intelligence).
--
--   Esegui nella SQL Editor di Supabase → RUN. Sicura da rieseguire.
-- ═══════════════════════════════════════════════════════════════════

drop policy if exists "bonus_select_operatore_self" on bonus;
do $$ begin
  create policy "bonus_select_operatore_self" on bonus
    for select to authenticated
    using (
      get_current_user_role() = 'OPERATORE_SELF'
      and (bookmaker = any(get_current_bookmaker_scope()) or id_collab is not null)
    );
exception when duplicate_object then null; end $$;

drop policy if exists "clienti_select_operatore_self" on clienti;
do $$ begin
  create policy "clienti_select_operatore_self" on clienti
    for select to authenticated
    using (
      get_current_user_role() = 'OPERATORE_SELF'
      and (
        exists (select 1 from bonus b where b.id_cli = clienti.id and b.bookmaker = any(get_current_bookmaker_scope()))
        or clienti.collab is not null
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "collab_select_operatore_self" on collab
    for select to authenticated
    using (get_current_user_role() = 'OPERATORE_SELF');
exception when duplicate_object then null; end $$;

select 'OPERATORE_SELF ora vede anche Collaboratori.' as risultato;
