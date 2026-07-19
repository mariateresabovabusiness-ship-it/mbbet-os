-- ═══════════════════════════════════════════════════════════════════
--   Fase 2 · Nuovo ruolo OPERATORE_SELF — vista personale per Nico
--
--   Nico si occupa solo delle registrazioni sui bookmaker Sunbet e
--   Goldbet (elenco ampliabile in futuro). Vede/lavora SOLO le righe
--   bonus di quei bookmaker — non tocca chi è "operatore" del cliente
--   (quel campo resta legato alla provvigione, per scelta esplicita di
--   Mary: sono due concetti separati).
--
--   Esegui nella SQL Editor di Supabase → RUN. Sicura da rieseguire.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Elenco bookmaker assegnati, per persona (NULL = nessuna restrizione)
alter table utenti_crm add column if not exists bookmaker_scope text[];

-- 2) Nuovo valore ammesso nel ruolo
alter table utenti_crm drop constraint if exists ruolo_valido;
alter table utenti_crm add constraint ruolo_valido check (
  ruolo in ('SOCIO_ADMIN','SOCIO','OPERATORE','COLLAB','COLLAB_SELF','REFERRAL','VIEWER','ADMIN_TECNICO','OPERATORE_SELF')
);

-- 3) Bookmaker assegnati all'utente loggato
create or replace function get_current_bookmaker_scope()
returns text[]
language sql stable security definer
set search_path = public
as $$
  select bookmaker_scope from utenti_crm where auth_user_id = auth.uid()
$$;

-- 4) RLS bonus: vede/aggiorna solo i bookmaker nel proprio elenco
do $$ begin
  create policy "bonus_select_operatore_self" on bonus
    for select to authenticated
    using (
      get_current_user_role() = 'OPERATORE_SELF'
      and bookmaker = any(get_current_bookmaker_scope())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bonus_update_operatore_self" on bonus
    for update to authenticated
    using (
      get_current_user_role() = 'OPERATORE_SELF'
      and bookmaker = any(get_current_bookmaker_scope())
    )
    with check (
      get_current_user_role() = 'OPERATORE_SELF'
      and bookmaker = any(get_current_bookmaker_scope())
    );
exception when duplicate_object then null; end $$;

-- 5) RLS clienti: vede solo chi ha almeno un bonus nel proprio elenco (sola lettura)
do $$ begin
  create policy "clienti_select_operatore_self" on clienti
    for select to authenticated
    using (
      get_current_user_role() = 'OPERATORE_SELF'
      and exists (
        select 1 from bonus b
        where b.id_cli = clienti.id
          and b.bookmaker = any(get_current_bookmaker_scope())
      )
    );
exception when duplicate_object then null; end $$;

-- 6) Riga utenti_crm per Nico — auth_user_id resta NULL finché non crei
--    l'account vero da Supabase → Authentication → Users (email sotto),
--    poi esegui la PARTE M di migration_auth.sql per collegarli.
insert into utenti_crm (email, nome, ruolo, bookmaker_scope, attivo)
values ('niko@mbbet.it', 'NIKO', 'OPERATORE_SELF', array['Sunbet','Goldbet'], true)
on conflict (email) do update set
  ruolo = excluded.ruolo,
  bookmaker_scope = excluded.bookmaker_scope,
  attivo = true,
  updated_at = now();

select 'OPERATORE_SELF pronto. Ora crea l''account per niko@mbbet.it in Authentication → Users, poi esegui PARTE M di migration_auth.sql.' as risultato;
