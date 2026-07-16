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

-- Nota: 'telefono' è una colonna duplicata di 'tel' (vedi migration_colonne_clienti.sql) —
-- non le mettiamo un vincolo separato per non rischiare falsi conflitti tra le due colonne
-- finché non vengono unificate in una futura pulizia dati.
