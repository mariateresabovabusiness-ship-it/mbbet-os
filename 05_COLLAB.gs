// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 05_COLLAB.gs
//   Collaboratori — CRUD, saldo, report
//   v3.0
// ═══════════════════════════════════════════════════════════════════════

const Collab = (() => {

  // ══════════════════════════════════════════════════════════════════
  // FIND — cerca collab per nome (case-insensitive)
  // ══════════════════════════════════════════════════════════════════

  function findByNome(query) {
    const q = query.toLowerCase();
    return DB.find(SH.COLLAB, r =>
      (r[COL.CLB.NOME] || '').toLowerCase().includes(q) ||
      (r[COL.CLB.ID]   || '').toLowerCase().includes(q)
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // GET ALL ATTIVE
  // ══════════════════════════════════════════════════════════════════

  function getAttive() {
    return DB.find(SH.COLLAB, r => r[COL.CLB.STATO] === 'Attiva');
  }

  // ══════════════════════════════════════════════════════════════════
  // CLIENTI DI UNA COLLAB — conta e ritorna righe
  // ══════════════════════════════════════════════════════════════════

  function getClienti(idCollab) {
    const c = DB.findById(SH.COLLAB, idCollab);
    if (!c) return [];
    const nomeCollab = c.row[COL.CLB.NOME];
    return DB.find(SH.CLIENTI, r => (r[COL.CLI.COLLAB] || '') === nomeCollab);
  }

  // ══════════════════════════════════════════════════════════════════
  // STATS — riepilogo saldo collab
  // ══════════════════════════════════════════════════════════════════

  function stats(idCollab) {
    const c = DB.findById(SH.COLLAB, idCollab);
    if (!c) return null;
    const nomeC   = c.row[COL.CLB.NOME];
    const perc    = parseFloat(c.row[COL.CLB.PERC]) || 0;
    const bnsData = DB.find(SH.BONUS, r => (r[COL.BNS.NOME_COLLAB] || '') === nomeC);
    const totRic  = bnsData.reduce((s,b) => s + (parseFloat(b[COL.BNS.RIC_REAL])||0), 0);
    const totComp = totRic * (perc / 100);
    const pagData = DB.find(SH.PAGAMENTI, r =>
      r[COL.PAG.TIPO] === 'Collab' && (r[COL.PAG.NOME_CLI] || '') === nomeC
    );
    const totPag  = pagData.reduce((s,p) => s + (parseFloat(p[COL.PAG.IMPORTO])||0), 0);
    return {
      nome: nomeC, perc, totRic, totComp,
      totPag, saldo: totComp - totPag,
      nClienti: getClienti(idCollab).length,
      nBns: bnsData.length,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // AGGIORNA STATO
  // ══════════════════════════════════════════════════════════════════

  function setStato(idCollab, stato) {
    const c = DB.findById(SH.COLLAB, idCollab);
    if (!c) return false;
    DB.update(SH.COLLAB, c.sheetRow, {
      [COL.CLB.STATO]:   stato,
      [COL.CLB.ULT_ATT]: new Date(),
    });
    DB.invalidate(SH.COLLAB);
    return true;
  }

  // ══════════════════════════════════════════════════════════════════
  // AGGIUNGI COLLAB SU CLIENTE — linka nome collab al cliente
  // ══════════════════════════════════════════════════════════════════

  function linkCliente(idCli, nomeCollab) {
    const c = DB.findById(SH.CLIENTI, idCli);
    if (!c) return false;
    DB.update(SH.CLIENTI, c.sheetRow, { [COL.CLI.COLLAB]: nomeCollab });
    // Propaga sui bonus
    const bnsCliente = DB.find(SH.BONUS, b => b[COL.BNS.ID_CLI] === idCli);
    const shB = DB.ss().getSheetByName(SH.BONUS);
    bnsCliente.forEach(b => {
      const fb = DB.findById(SH.BONUS, b[COL.BNS.ID]);
      if (!fb) return;
      shB.getRange(fb.sheetRow, COL.BNS.NOME_COLLAB + 1).setValue(nomeCollab);
      // COMP_COLLAB aggiornata dalla formula automaticamente
    });
    DB.invalidate(SH.CLIENTI);
    DB.invalidate(SH.BONUS);
    return true;
  }

  // ── EXPOSE ────────────────────────────────────────────────────────
  return { findByNome, getAttive, getClienti, stats, setStato, linkCliente };

})();
