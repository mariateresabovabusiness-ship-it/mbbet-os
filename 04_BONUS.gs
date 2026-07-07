// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 04_BONUS.gs
//   Bonus Module — stati, aggiornamenti, tier, gestione bookmaker
//   v3.0
// ═══════════════════════════════════════════════════════════════════════

const Bonus = (() => {

  // ── Stati validi ──────────────────────────────────────────────────
  const STATI = ['LIBERO', 'IN CORSO', 'FATTO', 'STANDBY', 'BLOCCATO', 'NON IDONEO'];

  const TIER_ORD = { 'S+':0, 'S':1, 'A':2, 'B':3, 'C':4, 'Standby':5 };

  // ══════════════════════════════════════════════════════════════════
  // UPDATE STATO — cambia stato singola riga bonus
  // ══════════════════════════════════════════════════════════════════

  function updateStato(idBonus, nuovoStato, note) {
    if (!STATI.includes(nuovoStato)) return { ok: false, err: `Stato non valido: ${nuovoStato}` };

    const found = DB.findById(SH.BONUS, idBonus);
    if (!found) return { ok: false, err: `Bonus ${idBonus} non trovato` };

    const updates = {
      [COL.BNS.STATO]:   nuovoStato,
      [COL.BNS.ULT_AZ]:  new Date(),
    };
    if (note) updates[COL.BNS.NOTE] = note;

    DB.update(SH.BONUS, found.sheetRow, updates);
    DB.invalidate(SH.BONUS);

    // Colora cella stato
    const shB = DB.ss().getSheetByName(SH.BONUS);
    const s   = STATUS_STYLE[nuovoStato];
    if (s) {
      shB.getRange(found.sheetRow, COL.BNS.STATO + 1)
        .setBackground(s.bg).setFontColor(s.fg).setFontWeight(s.bold ? 'bold' : 'normal');
    }

    DB.log('BONUS', idBonus, found.row[COL.BNS.CLIENTE],
      `Stato: ${found.row[COL.BNS.STATO]} → ${nuovoStato}`, 'OK', '');
    return { ok: true };
  }

  // ══════════════════════════════════════════════════════════════════
  // GET BY CLIENTE — tutti i bonus di un cliente
  // ══════════════════════════════════════════════════════════════════

  function getByCliente(idCli) {
    return DB.find(SH.BONUS, r => r[COL.BNS.ID_CLI] === idCli)
      .sort((a, b) => (TIER_ORD[a[COL.BNS.TIER]]||5) - (TIER_ORD[b[COL.BNS.TIER]]||5));
  }

  // ══════════════════════════════════════════════════════════════════
  // GET CONSIGLIATO — prossimo bookmaker da avviare
  // ══════════════════════════════════════════════════════════════════

  function getProssimoConsigliato(idCli) {
    const liberi = DB.find(SH.BONUS, r =>
      r[COL.BNS.ID_CLI] === idCli && r[COL.BNS.STATO] === 'LIBERO'
    ).sort((a, b) => (TIER_ORD[a[COL.BNS.TIER]]||5) - (TIER_ORD[b[COL.BNS.TIER]]||5));
    return liberi[0] || null;
  }

  // ══════════════════════════════════════════════════════════════════
  // ADD BOOKMAKER A TUTTI I CLIENTI ATTIVI
  // ══════════════════════════════════════════════════════════════════
  // Usato quando si aggiunge un nuovo bookmaker dopo il lancio.

  function addBookmakerToAll(nomeBk, tier) {
    const tier_ = tier || 'B';
    const cliData = DB.read(SH.CLIENTI);
    const bnsData = DB.read(SH.BONUS);
    const shB     = DB.ss().getSheetByName(SH.BONUS);
    let n = 0;

    cliData.forEach(r => {
      if (!r[COL.CLI.ID] || r[COL.CLI.STATO] !== 'ATTIVO') return;
      const idC = r[COL.CLI.ID];

      // Controlla se esiste già
      const esiste = bnsData.some(b => b[COL.BNS.ID_CLI] === idC && b[COL.BNS.BK] === nomeBk);
      if (esiste) return;

      const idBns = DB.nextId(SH.BONUS, PFX.BNS, 5);
      const riga  = new Array(COL.BNS._N).fill('');
      const riga_ = shB.getLastRow() + 1;

      riga[COL.BNS.ID]       = idBns;
      riga[COL.BNS.ID_CLI]   = idC;
      riga[COL.BNS.CLIENTE]  = r[COL.CLI.NOME];
      riga[COL.BNS.BK]       = nomeBk;
      riga[COL.BNS.TIER]     = tier_;
      riga[COL.BNS.STATO]    = 'LIBERO';
      riga[COL.BNS.OPERATORE]= r[COL.CLI.OPERATORE];
      riga[COL.BNS.PERC_OP]  = _DEFAULT_OP_PERC[r[COL.CLI.OPERATORE]] || 20;
      riga[COL.BNS.REFERRAL] = r[COL.CLI.REFERRAL];
      riga[COL.BNS.DATA_AP]  = new Date();
      riga[COL.BNS.PRIORITA] = 'MEDIA';

      shB.getRange(riga_, 1, 1, riga.length).setValues([riga]);
      shB.getRange(riga_, COL.BNS.COMP_OP + 1).setFormula(FX.bns_compOp(riga_)).setNumberFormat(FMT.EURO);
      shB.getRange(riga_, COL.BNS.MARGINE + 1).setFormula(FX.bns_margine(riga_)).setNumberFormat(FMT.EURO);
      n++;
    });

    DB.invalidate(SH.BONUS);
    DB.log('BONUS', 'BULK_ADD', nomeBk, `Aggiunto ${nomeBk} a ${n} clienti attivi`, 'OK', '');
    return n;
  }

  const _DEFAULT_OP_PERC = { 'Manu':20, 'Sere':25, 'Samu':20, 'Mary':25 };

  // ══════════════════════════════════════════════════════════════════
  // AGGIORNA RICAVO REALE — registra ricavo effettivo di un bonus
  // ══════════════════════════════════════════════════════════════════

  function setRicavoReale(idBonus, ricavo, pagato) {
    const found = DB.findById(SH.BONUS, idBonus);
    if (!found) return { ok: false, err: 'Bonus non trovato' };

    const updates = { [COL.BNS.RIC_REAL]: ricavo };
    if (pagato !== undefined) updates[COL.BNS.PAG_CLI] = pagato;
    if (found.row[COL.BNS.STATO] !== 'FATTO') updates[COL.BNS.STATO] = 'FATTO';
    updates[COL.BNS.ULT_AZ] = new Date();

    DB.update(SH.BONUS, found.sheetRow, updates);
    DB.invalidate(SH.BONUS);
    return { ok: true };
  }

  // ══════════════════════════════════════════════════════════════════
  // STATISTICHE — riepilogo veloce per cliente
  // ══════════════════════════════════════════════════════════════════

  function statsCliente(idCli) {
    const bns = getByCliente(idCli);
    return {
      totale:   bns.length,
      inCorso:  bns.filter(b=>b[COL.BNS.STATO]==='IN CORSO').length,
      liberi:   bns.filter(b=>b[COL.BNS.STATO]==='LIBERO').length,
      fatti:    bns.filter(b=>b[COL.BNS.STATO]==='FATTO').length,
      standby:  bns.filter(b=>b[COL.BNS.STATO]==='STANDBY').length,
      ricavoTot: bns.reduce((s,b)=>s+(parseFloat(b[COL.BNS.RIC_REAL])||0),0),
      margineTot: bns.reduce((s,b)=>s+(parseFloat(b[COL.BNS.MARGINE])||0),0),
    };
  }

  // ── EXPOSE ────────────────────────────────────────────────────────
  return { updateStato, getByCliente, getProssimoConsigliato,
           addBookmakerToAll, setRicavoReale, statsCliente, STATI, TIER_ORD };

})();
