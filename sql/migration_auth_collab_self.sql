-- MBBET OS · Migration: RLS per COLLAB/COLLAB_SELF (Fase 1)
-- Esegui nella SQL Editor di Supabase → RUN, DOPO migration_auth.sql
--
-- migration_auth.sql è stata scritta il 2026-07-01, prima che esistesse il ruolo
-- COLLAB_SELF (Alan/Isma/Lorenzo, vista personale in 07_collab.html). Oggi quindi
-- manca del tutto una policy che lasci a COLLAB/COLLAB_SELF vedere/modificare i
-- PROPRI clienti — senza questo file, appena l'RLS diventa reale (Fase 1),
-- 07_collab.html risulterebbe vuoto per Alan/Isma/Lorenzo/Samuele.
--
-- Sicura da rieseguire più volte: ogni policy è avvolta in un blocco che ignora
-- l'errore "già esistente" invece di fallire, perché non è certo quali pezzi di
-- migration_auth.sql siano già stati eseguiti in precedenza.

-- ── Helper: nome del collaboratore dell'utente corrente (clienti.collab e
--    bonus.nome_collab salvano il NOME del collaboratore, non il suo id) ──
create or replace function get_current_collab_nome()
returns text
language sql stable security definer
set search_path = public
as $$
  select c.nome from utenti_crm u
  join collab c on c.id = u.collab_id
  where u.auth_user_id = auth.uid() and u.attivo = true
  limit 1
$$;

do $$ begin
  create policy "clienti_select_collab" on clienti
    for select to authenticated
    using (
      get_current_user_role() in ('COLLAB','COLLAB_SELF')
      and collab = get_current_collab_nome()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "clienti_insert_collab" on clienti
    for insert to authenticated
    with check (
      get_current_user_role() in ('COLLAB','COLLAB_SELF')
      and collab = get_current_collab_nome()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "clienti_update_collab" on clienti
    for update to authenticated
    using (
      get_current_user_role() in ('COLLAB','COLLAB_SELF')
      and collab = get_current_collab_nome()
    )
    with check (
      -- consente anche di sganciare il cliente (collab -> null) via rimuoviClienteDaCollab
      get_current_user_role() in ('COLLAB','COLLAB_SELF')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bonus_select_collab" on bonus
    for select to authenticated
    using (
      get_current_user_role() in ('COLLAB','COLLAB_SELF')
      and nome_collab = get_current_collab_nome()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bonus_insert_collab" on bonus
    for insert to authenticated
    with check (
      get_current_user_role() in ('COLLAB','COLLAB_SELF')
      and nome_collab = get_current_collab_nome()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bonus_update_collab" on bonus
    for update to authenticated
    using (
      get_current_user_role() in ('COLLAB','COLLAB_SELF')
      and nome_collab = get_current_collab_nome()
    )
    with check (
      get_current_user_role() in ('COLLAB','COLLAB_SELF')
      and nome_collab = get_current_collab_nome()
    );
exception when duplicate_object then null; end $$;

-- La collab vede/modifica anche la propria riga in collab (es. per leggere modello/perc)
do $$ begin
  create policy "collab_select_self_v2" on collab
    for select to authenticated
    using (
      get_current_user_role() in ('COLLAB','COLLAB_SELF')
      and id = get_current_collab_id()
    );
exception when duplicate_object then null; end $$;

select 'Migration AUTH collab_self completata.' as risultato;
