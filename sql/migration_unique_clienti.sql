-- MBBET OS · Migration: vincoli anti-duplicato reali su clienti (Fase 0)
-- Esegui nella SQL Editor di Supabase → RUN
-- Oggi il controllo duplicati è solo JS (bypassabile col bottone "Conferma comunque" in
-- 10_onboarding_cliente.html) — questi indici impediscono il duplicato anche se un insert
-- arriva senza passare da quel controllo (import, bug futuri, altri form).
-- Verificato prima di scrivere questa migration: nessun duplicato reale oggi su tel/email
-- (query diretta al DB in produzione, 240 righe, 0 valori ripetuti su tel/telefono/email).

create unique index if not exists clienti_tel_uniq
  on clienti (tel)
  where tel is not null and tel <> '';

create unique index if not exists clienti_email_uniq
  on clienti (email)
  where email is not null and email <> '';

-- 'telefono' è una colonna duplicata di 'tel' (vedi migration_colonne_clienti.sql), popolata
-- da form_onboarding.html (che non scrive mai su 'tel') — senza un vincolo qui i duplicati
-- inseriti da quel modulo pubblico non erano protetti a livello database.
create unique index if not exists clienti_telefono_uniq
  on clienti (telefono)
  where telefono is not null and telefono <> '';
