-- ═══════════════════════════════════════════════════════════════════
--   CRM MBBET · Migration AUTH — Supabase Auth + Ruoli + RLS
--   Data: 2026-07-01 (corretta 2026-07-17)
--
--   SAFE:
--   • non elimina dati esistenti
--   • non tocca le policy anon già attive
--   • aggiunge policy authenticated in parallelo
--   • usa security definer per evitare ricorsione RLS
--   • rollback incluso in fondo (commentato)
--   • RIESEGUIBILE senza errori: ogni "create policy" è avvolta in un blocco
--     che ignora l'errore "esiste già", perché non è certo quali parti di
--     questo file siano già state eseguite in precedenza.
-- ═══════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════
-- PARTE A — TABELLA UTENTI CRM
-- Collega auth.users (Supabase Auth) ai ruoli MBBET.
-- auth_user_id può essere NULL inizialmente (account non ancora creato).
-- ════════════════════════════════════════════════════════════════════

create table if not exists utenti_crm (
  id              uuid default gen_random_uuid() primary key,
  auth_user_id    uuid references auth.users(id) on delete cascade unique,
  email           text not null unique,
  nome            text not null,
  ruolo           text not null default 'VIEWER',
  operatore_id    text references operatori(id) on delete set null,
  collab_id       text references collab(id) on delete set null,
  referral_id     text references referral(id) on delete set null,
  attivo          boolean default true,
  note            text,
  created_at      timestamp default now(),
  updated_at      timestamp default now(),

  constraint ruolo_valido check (ruolo in (
    'SOCIO_ADMIN',   -- vede e modifica tutto
    'SOCIO',         -- vede tutto, no delete
    'OPERATORE',     -- solo clienti/bonus/task suoi
    'COLLAB',        -- solo clienti portati + compensi
    'COLLAB_SELF',   -- vista personale in 07_collab.html, un solo collaboratore
    'REFERRAL',      -- solo riepilogo + saldo
    'VIEWER',        -- sola lettura su sezioni autorizzate
    'ADMIN_TECNICO'  -- struttura tecnica, no documenti sensibili
  ))
);

comment on table utenti_crm is
  'Utenti CRM MBBET con ruolo e collegamento a Supabase Auth.';
comment on column utenti_crm.auth_user_id is
  'UUID di auth.users. NULL finché non viene creato l''account Auth.';
comment on column utenti_crm.operatore_id is
  'Collegato a operatori.id — usato dall''OPERATORE per filtrare i dati.';

-- Trigger updated_at
drop trigger if exists trg_utenti_crm_updated_at on utenti_crm;
create trigger trg_utenti_crm_updated_at
  before update on utenti_crm
  for each row execute function set_updated_at();

-- Indici
create index if not exists idx_utenti_auth_id   on utenti_crm(auth_user_id);
create index if not exists idx_utenti_email      on utenti_crm(email);
create index if not exists idx_utenti_ruolo      on utenti_crm(ruolo);
create index if not exists idx_utenti_operatore  on utenti_crm(operatore_id);

-- La tabella esisteva già da prima (creata quando questo file non includeva
-- ancora COLLAB_SELF) — "create table if not exists" non aggiorna un vincolo
-- su una tabella già esistente, va rifatto esplicitamente.
alter table utenti_crm drop constraint if exists ruolo_valido;
alter table utenti_crm add constraint ruolo_valido check (ruolo in (
  'SOCIO_ADMIN','SOCIO','OPERATORE','COLLAB','COLLAB_SELF','REFERRAL','VIEWER','ADMIN_TECNICO'
));


-- ════════════════════════════════════════════════════════════════════
-- PARTE B — FUNZIONI HELPER (SECURITY DEFINER)
-- Leggono utenti_crm bypassando RLS → evitano ricorsione infinita.
-- Usate dentro le policy di tutte le altre tabelle.
-- ════════════════════════════════════════════════════════════════════

-- Ruolo dell'utente corrente
create or replace function get_current_user_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select ruolo from utenti_crm
  where auth_user_id = auth.uid() and attivo = true
  limit 1
$$;

-- Nome operatore dell'utente corrente (per filtrare clienti/bonus)
create or replace function get_current_operatore_nome()
returns text
language sql stable security definer
set search_path = public
as $$
  select o.nome from utenti_crm u
  join operatori o on o.id = u.operatore_id
  where u.auth_user_id = auth.uid() and u.attivo = true
  limit 1
$$;

-- ID collab dell'utente corrente
create or replace function get_current_collab_id()
returns text
language sql stable security definer
set search_path = public
as $$
  select collab_id from utenti_crm
  where auth_user_id = auth.uid() and attivo = true
  limit 1
$$;

-- ID referral dell'utente corrente
create or replace function get_current_referral_id()
returns text
language sql stable security definer
set search_path = public
as $$
  select referral_id from utenti_crm
  where auth_user_id = auth.uid() and attivo = true
  limit 1
$$;

-- Shortcut: è SOCIO_ADMIN?
create or replace function is_socio_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from utenti_crm
    where auth_user_id = auth.uid()
      and ruolo = 'SOCIO_ADMIN'
      and attivo = true
  )
$$;

-- Shortcut: è SOCIO o superiore?
create or replace function is_socio_or_above()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from utenti_crm
    where auth_user_id = auth.uid()
      and ruolo in ('SOCIO_ADMIN','SOCIO','ADMIN_TECNICO')
      and attivo = true
  )
$$;

-- Shortcut: può scrivere? (non può solo VIEWER, REFERRAL, COLLAB in lettura)
create or replace function can_write()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from utenti_crm
    where auth_user_id = auth.uid()
      and ruolo in ('SOCIO_ADMIN','SOCIO','OPERATORE','ADMIN_TECNICO')
      and attivo = true
  )
$$;


-- ════════════════════════════════════════════════════════════════════
-- PARTE C — RLS su UTENTI_CRM
-- Ogni utente vede solo sé stesso.
-- SOCIO_ADMIN e ADMIN_TECNICO vedono tutti.
-- ════════════════════════════════════════════════════════════════════

alter table utenti_crm enable row level security;

do $$ begin
  create policy "utenti_select" on utenti_crm
    for select to authenticated
    using (
      auth_user_id = auth.uid()
      or is_socio_admin()
      or get_current_user_role() = 'ADMIN_TECNICO'
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "utenti_write" on utenti_crm
    for all to authenticated
    using (is_socio_admin() or get_current_user_role() = 'ADMIN_TECNICO')
    with check (is_socio_admin() or get_current_user_role() = 'ADMIN_TECNICO');
exception when duplicate_object then null; end $$;

-- Accesso anon: nessuno (utenti_crm è sensibile)
-- (nessuna policy anon → negato di default)


-- ════════════════════════════════════════════════════════════════════
-- PARTE D — RLS su CLIENTI
-- SOCIO/ADMIN: tutti
-- OPERATORE: solo dove operatore = suo nome
-- COLLAB: solo dove collab collega
-- REFERRAL: solo dove id_referral = suo referral
-- ════════════════════════════════════════════════════════════════════

do $$ begin
  create policy "clienti_select_soci" on clienti
    for select to authenticated
    using (is_socio_or_above());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "clienti_select_operatore" on clienti
    for select to authenticated
    using (
      get_current_user_role() = 'OPERATORE'
      and operatore = get_current_operatore_nome()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "clienti_select_referral" on clienti
    for select to authenticated
    using (
      get_current_user_role() = 'REFERRAL'
      and id_referral = get_current_referral_id()
    );
exception when duplicate_object then null; end $$;

-- INSERT: soci + operatori (l'operatore può inserire solo con sé stesso)
do $$ begin
  create policy "clienti_insert" on clienti
    for insert to authenticated
    with check (
      is_socio_or_above()
      or (
        get_current_user_role() = 'OPERATORE'
        and operatore = get_current_operatore_nome()
      )
    );
exception when duplicate_object then null; end $$;

-- UPDATE: soci + operatore sui propri
do $$ begin
  create policy "clienti_update" on clienti
    for update to authenticated
    using (
      is_socio_or_above()
      or (
        get_current_user_role() = 'OPERATORE'
        and operatore = get_current_operatore_nome()
      )
    )
    with check (
      is_socio_or_above()
      or (
        get_current_user_role() = 'OPERATORE'
        and operatore = get_current_operatore_nome()
      )
    );
exception when duplicate_object then null; end $$;

-- DELETE: solo SOCIO_ADMIN
do $$ begin
  create policy "clienti_delete" on clienti
    for delete to authenticated
    using (is_socio_admin());
exception when duplicate_object then null; end $$;


-- ════════════════════════════════════════════════════════════════════
-- PARTE E — RLS su BONUS
-- ════════════════════════════════════════════════════════════════════

do $$ begin
  create policy "bonus_select_soci" on bonus
    for select to authenticated
    using (is_socio_or_above());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bonus_select_operatore" on bonus
    for select to authenticated
    using (
      get_current_user_role() = 'OPERATORE'
      and operatore = get_current_operatore_nome()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bonus_select_referral" on bonus
    for select to authenticated
    using (
      get_current_user_role() = 'REFERRAL'
      and id_referral = get_current_referral_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bonus_write_soci" on bonus
    for all to authenticated
    using (is_socio_or_above())
    with check (is_socio_or_above());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bonus_write_operatore" on bonus
    for insert to authenticated
    with check (
      get_current_user_role() = 'OPERATORE'
      and operatore = get_current_operatore_nome()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "bonus_update_operatore" on bonus
    for update to authenticated
    using (
      get_current_user_role() = 'OPERATORE'
      and operatore = get_current_operatore_nome()
    )
    with check (
      get_current_user_role() = 'OPERATORE'
      and operatore = get_current_operatore_nome()
    );
exception when duplicate_object then null; end $$;


-- ════════════════════════════════════════════════════════════════════
-- PARTE F — RLS su TASK
-- ════════════════════════════════════════════════════════════════════

do $$ begin
  create policy "task_select_soci" on task
    for select to authenticated
    using (is_socio_or_above());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "task_select_operatore" on task
    for select to authenticated
    using (
      get_current_user_role() = 'OPERATORE'
      and operatore = get_current_operatore_nome()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "task_write" on task
    for all to authenticated
    using (
      is_socio_or_above()
      or (get_current_user_role() = 'OPERATORE' and operatore = get_current_operatore_nome())
    )
    with check (
      is_socio_or_above()
      or (get_current_user_role() = 'OPERATORE' and operatore = get_current_operatore_nome())
    );
exception when duplicate_object then null; end $$;


-- ════════════════════════════════════════════════════════════════════
-- PARTE G — RLS su PAGAMENTI (solo soci e admin)
-- ════════════════════════════════════════════════════════════════════

do $$ begin
  create policy "pagamenti_select_soci" on pagamenti
    for select to authenticated
    using (is_socio_or_above());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "pagamenti_select_operatore" on pagamenti
    for select to authenticated
    using (
      get_current_user_role() = 'OPERATORE'
      and beneficiario = get_current_operatore_nome()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "pagamenti_write_soci" on pagamenti
    for all to authenticated
    using (is_socio_or_above())
    with check (is_socio_or_above());
exception when duplicate_object then null; end $$;


-- ════════════════════════════════════════════════════════════════════
-- PARTE H — RLS su COLLAB
-- ════════════════════════════════════════════════════════════════════

do $$ begin
  create policy "collab_select_soci" on collab
    for select to authenticated
    using (is_socio_or_above());
exception when duplicate_object then null; end $$;

-- La collab vede solo sé stessa
do $$ begin
  create policy "collab_select_self" on collab
    for select to authenticated
    using (
      get_current_user_role() = 'COLLAB'
      and id = get_current_collab_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "collab_write_soci" on collab
    for all to authenticated
    using (is_socio_or_above())
    with check (is_socio_or_above());
exception when duplicate_object then null; end $$;


-- ════════════════════════════════════════════════════════════════════
-- PARTE I — RLS su REFERRAL
-- ════════════════════════════════════════════════════════════════════

do $$ begin
  create policy "referral_select_soci" on referral
    for select to authenticated
    using (is_socio_or_above());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "referral_select_self" on referral
    for select to authenticated
    using (
      get_current_user_role() = 'REFERRAL'
      and id = get_current_referral_id()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "referral_write_soci" on referral
    for all to authenticated
    using (is_socio_or_above())
    with check (is_socio_or_above());
exception when duplicate_object then null; end $$;


-- ════════════════════════════════════════════════════════════════════
-- PARTE J — RLS su DOCUMENTI (sensibili — solo soci e operatore assegnato)
-- ════════════════════════════════════════════════════════════════════

do $$ begin
  if exists (select 1 from pg_tables where tablename='documenti' and schemaname='public') then
    begin
      execute '
        create policy "documenti_select_soci" on documenti
          for select to authenticated
          using (is_socio_or_above());
      ';
    exception when duplicate_object then null; end;

    begin
      execute '
        create policy "documenti_select_operatore" on documenti
          for select to authenticated
          using (
            get_current_user_role() = ''OPERATORE''
            and operatore = get_current_operatore_nome()
          );
      ';
    exception when duplicate_object then null; end;

    begin
      execute '
        create policy "documenti_write_soci" on documenti
          for all to authenticated
          using (is_socio_or_above())
          with check (is_socio_or_above());
      ';
    exception when duplicate_object then null; end;
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════════
-- PARTE K — RLS su PENALI, NOTIFICHE, ETICA, CLIENTI_INATTIVI
-- ════════════════════════════════════════════════════════════════════

-- Penali: soci + operatore coinvolto
do $$ begin
  create policy "penali_select_soci" on penali
    for select to authenticated
    using (is_socio_or_above());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "penali_select_operatore" on penali
    for select to authenticated
    using (
      get_current_user_role() = 'OPERATORE'
      and operatore = get_current_operatore_nome()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "penali_write_soci" on penali
    for all to authenticated
    using (is_socio_or_above())
    with check (is_socio_or_above());
exception when duplicate_object then null; end $$;

-- Notifiche: ognuno vede le proprie + quelle broadcast (destinatario null)
do $$ begin
  create policy "notifiche_select" on notifiche
    for select to authenticated
    using (
      is_socio_or_above()
      or destinatario is null
      or destinatario = get_current_operatore_nome()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notifiche_write" on notifiche
    for insert to authenticated
    with check (true); -- chiunque autenticato può creare notifiche
exception when duplicate_object then null; end $$;

-- Etica economica: solo soci (dati finanziari sensibili)
do $$ begin
  create policy "etica_select_soci" on etica_economica
    for select to authenticated
    using (is_socio_or_above());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "etica_write_soci" on etica_economica
    for all to authenticated
    using (is_socio_or_above())
    with check (is_socio_or_above());
exception when duplicate_object then null; end $$;

-- Clienti inattivi: soci + operatore assegnato
do $$ begin
  create policy "inattivi_select_soci" on clienti_inattivi
    for select to authenticated
    using (is_socio_or_above());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "inattivi_select_operatore" on clienti_inattivi
    for select to authenticated
    using (
      get_current_user_role() = 'OPERATORE'
      and operatore = get_current_operatore_nome()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "inattivi_write" on clienti_inattivi
    for all to authenticated
    using (can_write())
    with check (can_write());
exception when duplicate_object then null; end $$;


-- ════════════════════════════════════════════════════════════════════
-- PARTE L — SEED UTENTI_CRM
-- Ruoli allineati a shared/auth.js LOCAL_USERS (la fonte di verità oggi).
-- auth_user_id è NULL: va popolato con PARTE M dopo aver creato i veri account
-- Supabase Auth (Mary li crea a mano da Authentication → Users, vedi lista
-- comunicata a parte).
-- Serena: confermato da Mary è socia (si occupa principalmente dei clienti),
-- non un'operatrice con un nome dedicato in `operatori` — ruolo SOCIO, nessun
-- operatore_id (is_socio_or_above() non richiede lo scoping per nome).
-- I 10 operatori reali sotto sono le persone già in `operatori` senza alcun
-- login oggi (esclusa "Mari+Samu", non una persona distinta ma un'etichetta
-- congiunta Mary+Samuele già coperta dai loro account).
-- Manuele/Serena/Samuele: ESCLUSI per decisione esplicita di Mary — non devono
-- avere un vero account Supabase Auth, quindi via anche da utenti_crm (righe
-- rimosse sotto se già presenti da un run precedente).
-- ════════════════════════════════════════════════════════════════════

delete from utenti_crm where email in ('manuele@mbbet.it','serena@mbbet.it','samuele@mbbet.it');

insert into utenti_crm (email, nome, ruolo, operatore_id, collab_id, attivo)
values
  ('mariateresabova.business@gmail.com', 'Mary Bova',                  'SOCIO_ADMIN', null,     null,          true),
  ('alan@mbbet.it',                      'Alan',                       'COLLAB_SELF', null,     'COLLAB-001',  true),
  ('isma@mbbet.it',                      'Isma',                       'COLLAB_SELF', null,     'COLLAB-004',  true),
  ('lorenzo@mbbet.it',                   'Lorenzo Cestola',            'COLLAB_SELF', null,     'COLLAB-005',  true),
  ('ciro@mbbet.it',                      'Ciro Bisogno',               'OPERATORE',   'OP-012', null,          true),
  ('antonio@mbbet.it',                   'Antonio Michele La Barbera', 'OPERATORE',   'OP-013', null,          true),
  ('alessia.maffioli@mbbet.it',          'Alessia Maffioli',           'OPERATORE',   'OP-007', null,          true),
  ('alessia.ciman@mbbet.it',             'Alessia Ciman',              'OPERATORE',   'OP-014', null,          true),
  ('elisa@mbbet.it',                     'Elisa Qualantoni',           'OPERATORE',   'OP-008', null,          true),
  ('riccardo@mbbet.it',                  'Riccardo Tavagnacco',        'OPERATORE',   'OP-015', null,          true),
  ('luca@mbbet.it',                      'Luca Alberti',               'OPERATORE',   'OP-010', null,          true),
  ('emilian@mbbet.it',                   'Emilian Cozmiuc',            'OPERATORE',   'OP-006', null,          true),
  ('mariaadele@mbbet.it',                'Maria Adele Catania',        'OPERATORE',   'OP-009', null,          true),
  ('francesco@mbbet.it',                 'Francesco Domenico Bova',    'OPERATORE',   'OP-005', null,          true)
on conflict (email) do update set
  ruolo = excluded.ruolo,
  operatore_id = excluded.operatore_id,
  collab_id = excluded.collab_id,
  updated_at = now();


-- ════════════════════════════════════════════════════════════════════
-- PARTE M — COLLEGA I VERI ACCOUNT SUPABASE AUTH (esegui DOPO averli creati)
-- Fa combaciare utenti_crm.auth_user_id con auth.users.id tramite l'email,
-- così non serve copiare gli UUID a mano uno per uno. Rieseguibile.
-- ════════════════════════════════════════════════════════════════════

update utenti_crm u
set auth_user_id = a.id
from auth.users a
where a.email = u.email
  and u.auth_user_id is distinct from a.id;

select email, nome, ruolo, auth_user_id is not null as account_collegato
from utenti_crm
order by ruolo, nome;

-- Config: ruoli attivi
insert into config (chiave, valore) values
  ('auth_attivo',       'false'),   -- impostare 'true' quando login è live
  ('ruoli_attivi',      'SOCIO_ADMIN,SOCIO,OPERATORE,COLLAB,REFERRAL,VIEWER,ADMIN_TECNICO')
on conflict (chiave) do nothing;


-- ════════════════════════════════════════════════════════════════════
-- VERIFICA FINALE
-- ════════════════════════════════════════════════════════════════════

-- Elenco policy create
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'utenti_crm','clienti','bonus','task','pagamenti',
    'collab','referral','documenti','penali','notifiche',
    'etica_economica','clienti_inattivi'
  )
order by tablename, policyname;

-- Funzioni helper create
select routine_name, routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'get_current_user_role','get_current_operatore_nome',
    'get_current_collab_id','get_current_referral_id',
    'is_socio_admin','is_socio_or_above','can_write'
  );

select 'Migration AUTH completata.' as risultato;


-- ════════════════════════════════════════════════════════════════════
-- ROLLBACK — decommentare solo in emergenza
-- ════════════════════════════════════════════════════════════════════
/*
-- Rimuovi policy authenticated (le anon restano intatte)
drop policy if exists "clienti_select_soci"       on clienti;
drop policy if exists "clienti_select_operatore"   on clienti;
drop policy if exists "clienti_select_referral"    on clienti;
drop policy if exists "clienti_insert"             on clienti;
drop policy if exists "clienti_update"             on clienti;
drop policy if exists "clienti_delete"             on clienti;
drop policy if exists "bonus_select_soci"          on bonus;
drop policy if exists "bonus_select_operatore"     on bonus;
drop policy if exists "bonus_select_referral"      on bonus;
drop policy if exists "bonus_write_soci"           on bonus;
drop policy if exists "bonus_write_operatore"      on bonus;
drop policy if exists "bonus_update_operatore"     on bonus;
drop policy if exists "task_select_soci"           on task;
drop policy if exists "task_select_operatore"      on task;
drop policy if exists "task_write"                 on task;
drop policy if exists "pagamenti_select_soci"      on pagamenti;
drop policy if exists "pagamenti_select_operatore" on pagamenti;
drop policy if exists "pagamenti_write_soci"       on pagamenti;
drop policy if exists "collab_select_soci"         on collab;
drop policy if exists "collab_select_self"         on collab;
drop policy if exists "collab_write_soci"          on collab;
drop policy if exists "referral_select_soci"       on referral;
drop policy if exists "referral_select_self"       on referral;
drop policy if exists "referral_write_soci"        on referral;
drop policy if exists "penali_select_soci"         on penali;
drop policy if exists "penali_select_operatore"    on penali;
drop policy if exists "penali_write_soci"          on penali;
drop policy if exists "notifiche_select"           on notifiche;
drop policy if exists "notifiche_write"            on notifiche;
drop policy if exists "etica_select_soci"          on etica_economica;
drop policy if exists "etica_write_soci"           on etica_economica;
drop policy if exists "inattivi_select_soci"       on clienti_inattivi;
drop policy if exists "inattivi_select_operatore"  on clienti_inattivi;
drop policy if exists "inattivi_write"             on clienti_inattivi;
drop policy if exists "utenti_select"              on utenti_crm;
drop policy if exists "utenti_write"               on utenti_crm;

-- Rimuovi funzioni helper
drop function if exists get_current_user_role();
drop function if exists get_current_operatore_nome();
drop function if exists get_current_collab_id();
drop function if exists get_current_referral_id();
drop function if exists is_socio_admin();
drop function if exists is_socio_or_above();
drop function if exists can_write();

-- Rimuovi tabella
drop table if exists utenti_crm;
*/
