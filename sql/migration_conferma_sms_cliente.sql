-- ═══════════════════════════════════════════════════════════════════
--   MBBET OS · Migration: Conferma codice SMS dal cliente
--
--   Quando Serena/Nico avvisano un cliente che sta per arrivargli un SMS
--   di verifica, il cliente riceve un link a una pagina pubblica dove
--   scrive SOLO il codice — niente altro. Il codice arriva subito sulla
--   riga del sito giusto, e chi coordina riceve un avviso Telegram
--   automatico col codice già dentro, senza dover controllare WhatsApp.
--
--   SAFE: usa IF NOT EXISTS / ON CONFLICT, riseguibile
--   Incolla nella SQL Editor di Supabase e clicca RUN
-- ═══════════════════════════════════════════════════════════════════

alter table bonus add column if not exists codice_sms text;
alter table bonus add column if not exists codice_sms_ricevuto_at timestamp;

-- RPC minima per il form pubblico: aggiorna SOLO il codice SMS di UNA riga
-- bonus specifica (via id), non espone né richiede lettura di nessun'altra
-- colonna — stesso principio già usato per rpc_check_dup_cliente ecc.
create or replace function rpc_submit_codice_sms(p_bonus_id text, p_codice text)
returns table(cliente text, bookmaker text)
language plpgsql security definer
set search_path = public
as $$
begin
  update bonus
  set codice_sms = p_codice, codice_sms_ricevuto_at = now(), updated_at = now()
  where id = p_bonus_id;
  return query select b.cliente, b.bookmaker from bonus b where b.id = p_bonus_id;
end;
$$;

grant execute on function rpc_submit_codice_sms(text, text) to anon;

insert into config (chiave, valore)
values ('Notifica codice SMS ricevuto', 'Serena')
on conflict (chiave) do nothing;

select 'Migration conferma SMS cliente completata.' as risultato;
