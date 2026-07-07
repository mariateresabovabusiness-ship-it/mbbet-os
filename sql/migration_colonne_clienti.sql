-- MBBET OS · Migration: colonne mancanti su tabella clienti
-- Esegui nella SQL Editor di Supabase → RUN
-- Safe: IF NOT EXISTS, non rompe nulla di esistente

alter table clienti
  add column if not exists cognome            text,
  add column if not exists telefono           text,
  add column if not exists data_nascita       date,
  add column if not exists citta              text,
  add column if not exists iban               text,
  add column if not exists bookmaker_disponibili  text[] default '{}',
  add column if not exists bookmaker_completati   text[] default '{}';

-- Copia i dati esistenti da tel → telefono (se ci sono righe vecchie)
update clienti set telefono = tel where telefono is null and tel is not null;
