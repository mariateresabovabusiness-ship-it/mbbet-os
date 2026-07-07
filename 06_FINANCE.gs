// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 06_FINANCE.gs
//   Finanze — Pagamenti, Margine, Riepilogo Operatori
//   v3.0
// ═══════════════════════════════════════════════════════════════════════

const Finance = (() => {

  // ══════════════════════════════════════════════════════════════════
  // REGISTRA PAGAMENTO
  // ══════════════════════════════════════════════════════════════════

  function registraPagamento(opts) {
    // opts: { beneficiario, importo, tipo, causale, idCli?, metodo? }
    if (!opts.beneficiario || !opts.importo) {
      return { ok: false, err: 'Beneficiario e importo obbligatori' };
    }
    const shP  = DB.ss().getSheetByName(SH.PAGAMENTI);
    const idP  = DB.nextId(SH.PAGAMENTI, PFX.PAG, 4);
    const row  = new Array(COL.PAG._N).fill('');
    row[COL.PAG.ID]           = idP;
    row[COL.PAG.DATA]         = new Date();
    row[COL.PAG.NOME_CLI]     = opts.idCli || opts.beneficiario;
    row[COL.PAG.TIPO]         = opts.tipo || 'Altro';
    row[COL.PAG.BENEFICIARIO] = opts.beneficiario;
    row[COL.PAG.IMPORTO]      = parseFloat(opts.importo) || 0;
    row[COL.PAG.METODO]       = opts.metodo || 'Bonifico';
    row[COL.PAG.CAUSALE]      = opts.causale || '';
    row[COL.PAG.STATO]        = 'Pagato';

    const riga = shP.getLastRow() + 1;
    shP.getRange(riga, 1, 1, row.length).setValues([row]);
    shP.getRange(riga, COL.PAG.IMPORTO + 1).setNumberFormat(FMT.EURO);
    shP.getRange(riga, COL.PAG.DATA + 1).setNumberFormat(FMT.DATA);

    DB.invalidate(SH.PAGAMENTI);
    DB.log('PAGAMENTO', idP, opts.beneficiario,
      `${opts.tipo} | ${fmtEuro(opts.importo)} | ${opts.causale}`, 'OK', '');
    return { ok: true, id: idP };
  }

  // ══════════════════════════════════════════════════════════════════
  // RIEPILOGO OPERATORE — margine e compenso per un operatore
  // ══════════════════════════════════════════════════════════════════

  function riepilogoOperatore(opName) {
    const cliData  = DB.find(SH.CLIENTI, r => r[COL.CLI.OPERATORE] === opName);
    const bnsData  = DB.find(SH.BONUS,   r => r[COL.BNS.OPERATORE] === opName);
    const percOp   = parseFloat(DB.config(`% ${opName}`)) || (_DEFAULT_PERC[opName] || 20);

    const ricavoTot = bnsData.reduce((s,b) => s + (parseFloat(b[COL.BNS.RIC_REAL])||0), 0);
    const pagatoTot = bnsData.reduce((s,b) => s + (parseFloat(b[COL.BNS.PAG_CLI])||0), 0);
    const compOp    = bnsData.reduce((s,b) => s + (parseFloat(b[COL.BNS.COMP_OP])||0), 0);
    const margineTot= cliData.reduce((s,r) => s + (parseFloat(r[COL.CLI.MARGINE])||0), 0);

    const pagati    = DB.find(SH.PAGAMENTI, p =>
      p[COL.PAG.TIPO] === 'Operatore' && (p[COL.PAG.BENEFICIARIO] || '') === opName
    ).reduce((s,p) => s + (parseFloat(p[COL.PAG.IMPORTO])||0), 0);

    return {
      operatore: opName, percOp,
      nClienti:  cliData.length,
      ricavoTot, pagatoTot, compOp,
      margineTot, compDovuto: compOp,
      compGiaPagato: pagati,
      compDaPagare:  compOp - pagati,
    };
  }

  const _DEFAULT_PERC = { Manu:20, Sere:25, Samu:20, Mary:25 };

  // ══════════════════════════════════════════════════════════════════
  // RIEPILOGO GLOBALE — KPI complessivi
  // ══════════════════════════════════════════════════════════════════

  function riepilogoGlobale() {
    const bnsData = DB.read(SH.BONUS);
    const cliData = DB.read(SH.CLIENTI);
    const penData = DB.read(SH.PENALI);

    const ricavoTot = bnsData.reduce((s,b) => s+(parseFloat(b[COL.BNS.RIC_REAL])||0), 0);
    const pagatoTot = bnsData.reduce((s,b) => s+(parseFloat(b[COL.BNS.PAG_CLI])||0), 0);
    const compOpTot = bnsData.reduce((s,b) => s+(parseFloat(b[COL.BNS.COMP_OP])||0), 0);
    const margineTot= cliData.reduce((s,r) => s+(parseFloat(r[COL.CLI.MARGINE])||0), 0);
    const penTot    = penData.filter(p=>p[COL.PEN.STATO]==='In Calcolo')
                      .reduce((s,p)=>s+(parseFloat(p[COL.PEN.TOT_PEN])||0),0);

    return { ricavoTot, pagatoTot, compOpTot, margineTot, penTot };
  }

  // ══════════════════════════════════════════════════════════════════
  // SALDO CLIENTE — quanto si deve ancora a un cliente
  // ══════════════════════════════════════════════════════════════════

  function saldoCliente(idCli) {
    const c = DB.findById(SH.CLIENTI, idCli);
    if (!c) return null;
    const totDovuto = parseFloat(c.row[COL.CLI.TOT_PAGATO]) || 0;
    const pagato    = DB.find(SH.PAGAMENTI, p =>
      p[COL.PAG.TIPO] === 'Cliente' && p[COL.PAG.NOME_CLI] === idCli
    ).reduce((s,p) => s+(parseFloat(p[COL.PAG.IMPORTO])||0), 0);
    return {
      nome: c.row[COL.CLI.NOME], idCli,
      dovuto: totDovuto, pagato, saldo: totDovuto - pagato,
    };
  }

  // ── EXPOSE ────────────────────────────────────────────────────────
  return { registraPagamento, riepilogoOperatore, riepilogoGlobale, saldoCliente };

})();
