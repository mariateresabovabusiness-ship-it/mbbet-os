// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 03_CLIENTS.gs
//   Client Module — Lifecycle completo dei clienti
//   v3.0
// ═══════════════════════════════════════════════════════════════════════
//
//   API pubblica (oggetto Client):
//   Client.create(data)              → crea cliente + bonus rows + Drive folder
//   Client.update(id, updates)       → aggiorna campi specifici
//   Client.get(id)                   → profilo completo {client, bonuses}
//   Client.search(query)             → cerca per nome/tel/email/ID
//   Client.findDuplicate(data)       → controlla duplicati prima di creare
//   Client.registerAcceptance(...)   → registra accettazione condizioni
//   Client.addMissingBonus(id)       → aggiunge bookmaker mancanti
//   Client.createDriveFolder(id, nm) → crea cartella Drive
//   Client.getOperatorPerc(operName) → legge % da CONFIG
//   Client.calcReferralCost(id)      → calcola costo referral da tier
// ═══════════════════════════════════════════════════════════════════════

const Client = (() => {

  // ── Operatori predefiniti ────────────────────────────────────────────
  //    Percentuale default, aggiornabile in ⚙️ CONFIG
  const _DEFAULT_OP_PERC = {
    'Manu': 20, 'Sere': 25, 'Samu': 20, 'Mary': 25,
  };

  // ── Helper privato: attiva i bookmaker dalla sheet BOOKMAKER ────────

  function _getActiveBookmakers() {
    const data = DB.read(SH.BOOKMAKER);
    if (data.length === 0) {
      // Fallback: usa lista da constants se il foglio è vuoto
      return BOOKMAKERS.filter(b => b.attivo);
    }
    return data
      .filter(r => {
        const v = (r[2] || '').toString().toLowerCase();
        return v === 'sì' || v === 'si' || v === 'true' || v === '✅' || v === 'attivo';
      })
      .map(r => ({
        nome: (r[0] || '').toString().toUpperCase(),
        tier: (r[1] || '').toString(),
        rMin: parseFloat(r[4]) || 0,
        rMax: parseFloat(r[5]) || 0,
      }));
  }

  // ── Helper privato: legge % operatore da CONFIG ──────────────────────

  function _opPerc(operName) {
    if (!operName) return 20;
    const fromConfig = DB.config('% ' + operName);
    if (fromConfig) return parseFloat(fromConfig) || 20;
    const n = (operName || '').toString().trim().toLowerCase();
    for (const [k, v] of Object.entries(_DEFAULT_OP_PERC)) {
      if (k.toLowerCase() === n) return v;
    }
    return 20;
  }

  // ── Helper privato: costruisce array riga CLIENTI ─────────────────────

  function _buildClientRow(idC, data, linkDrive) {
    const row = new Array(COL.CLI._N).fill('');
    row[COL.CLI.ID]         = idC;
    row[COL.CLI.NOME]       = normNome(data.nome);
    row[COL.CLI.TEL]        = normTel(data.tel);
    row[COL.CLI.EMAIL]      = normEmail(data.email);
    row[COL.CLI.EMAIL_SITI] = normEmail(data.emailSiti || '');
    row[COL.CLI.OPERATORE]  = (data.operatore || '').toString().trim();
    row[COL.CLI.REFERRAL]   = (data.referral || '').toString().trim();
    row[COL.CLI.TIPOLOGIA]  = (data.tipologia || 'ORGANICO').toString().trim().toUpperCase();
    row[COL.CLI.SPID]       = normSpid(data.spid);
    row[COL.CLI.CC]         = normSpid(data.cc);   // stesso pattern sì/no
    row[COL.CLI.DATA_ING]   = data.dataIngresso || new Date();
    row[COL.CLI.STATO]      = 'ATTIVO';
    row[COL.CLI.DRIVE]      = linkDrive || '';
    // Colonne formula: TOT_RICAVO(13), TOT_PAGATO(14), MARGINE(15) → impostate da FX
    row[COL.CLI.COSTO_REF]  = 0;
    row[COL.CLI.POT_RESIDUO]= 0;
    row[COL.CLI.PROSS_BONUS]= '';
    row[COL.CLI.PRIORITA]   = data.priorita || 'MEDIA';
    row[COL.CLI.MESE]       = data.mese || Utilities.formatDate(new Date(), CFG.TIMEZONE, 'MM/yyyy');
    row[COL.CLI.NUOVO_VEC]  = data.nuovoVec || 'Nuovo';
    row[COL.CLI.NOTE]       = (data.note || '').toString().trim();
    row[COL.CLI.COLLAB]     = (data.collab || '').toString().trim();
    row[COL.CLI.DATA_ACC]   = '';
    row[COL.CLI.STATO_ACC]  = 'In Attesa';
    row[COL.CLI.PENALE_ATT] = 'No';
    row[COL.CLI.GG_RITARDO] = 0;
    row[COL.CLI.TOT_PENALE] = 0;
    row[COL.CLI.DATA_PRIMA_OP] = '';
    return row;
  }

  // ── Helper privato: costruisce righe BONUS per ogni bookmaker ────────

  function _buildBonusRows(idC, nomeC, operatore, referral, bookmakers) {
    const perc = _opPerc(operatore);
    return bookmakers.map((bk, i) => {
      const row = new Array(COL.BNS._N).fill('');
      // ID Bonus verrà assegnato dopo (usiamo placeholder per batch)
      row[COL.BNS.ID]         = '';  // da riempire dopo il maxId
      row[COL.BNS.ID_CLI]     = idC;
      row[COL.BNS.CLIENTE]    = nomeC;
      row[COL.BNS.BK]         = bk.nome;
      row[COL.BNS.TIER]       = bk.tier || '';
      row[COL.BNS.STATO]      = 'LIBERO';
      row[COL.BNS.OPERATORE]  = operatore || '';
      row[COL.BNS.PERC_OP]   = perc;
      row[COL.BNS.REFERRAL]  = referral || '';
      row[COL.BNS.RIC_PREV]  = bk.rMin || 0;
      row[COL.BNS.RIC_REAL]  = 0;
      row[COL.BNS.PAG_CLI]   = 0;
      // COMP_OP e MARGINE → formula
      row[COL.BNS.COSTI_EX]  = 0;
      row[COL.BNS.DATA_AP]   = new Date();
      row[COL.BNS.ULT_AZ]    = '';
      row[COL.BNS.PROSS_AZ]  = '';
      row[COL.BNS.PRIORITA]  = 'BASSA';
      row[COL.BNS.NOTE]       = '';
      row[COL.BNS.ID_COLLAB]  = '';
      row[COL.BNS.NOME_COLLAB]= '';
      row[COL.BNS.COMP_COLLAB]= 0;
      return row;
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // API PUBBLICA
  // ════════════════════════════════════════════════════════════════════

  // ── CREATE ────────────────────────────────────────────────────────────
  //    data: {nome, tel, email, emailSiti, operatore, referral, tipologia,
  //           spid, cc, mese, nuovoVec, note, collab, dataIngresso}
  //    Ritorna: {id, nomeCliente, bonusCreati, driveUrl}

  function create(data) {
    const nome = normNome(data.nome || '');
    if (!nome) throw new Error('Nome cliente obbligatorio');

    // 1. Controlla duplicati
    const dup = findDuplicate(data);
    if (dup) return {
      skip: true,
      id: dup[COL.CLI.ID],
      nomeCliente: dup[COL.CLI.NOME],
      motivo: `Già presente: ${dup[COL.CLI.ID]} — ${dup[COL.CLI.NOME]}`,
    };

    // 2. Genera ID cliente
    const idC = DB.nextId(SH.CLIENTI, PFX.CLI, 3);

    // 3. Crea cartella Drive (non bloccante — se fallisce, continua)
    let driveUrl = '';
    try { driveUrl = createDriveFolder(idC, nome); } catch (_) {}

    // 4. Costruisci riga cliente
    const cliRow = _buildClientRow(idC, data, driveUrl);

    // 5. Scrivi cliente (con formule calcolate)
    const shC = DB.ss().getSheetByName(SH.CLIENTI);
    const cliSheetRow = shC.getLastRow() + 1;
    shC.getRange(cliSheetRow, 1, 1, cliRow.length).setValues([cliRow]);
    // Formule CLIENTI: TOT_RICAVO(14), TOT_PAGATO(15), MARGINE(16)
    shC.getRange(cliSheetRow, COL.CLI.TOT_RICAVO + 1)
      .setFormula(FX.cli_totRicavo(cliSheetRow)).setNumberFormat(FMT.EURO);
    shC.getRange(cliSheetRow, COL.CLI.TOT_PAGATO + 1)
      .setFormula(FX.cli_totPagato(cliSheetRow)).setNumberFormat(FMT.EURO);
    shC.getRange(cliSheetRow, COL.CLI.MARGINE + 1)
      .setFormula(FX.cli_margine(cliSheetRow)).setNumberFormat(FMT.EURO);
    shC.getRange(cliSheetRow, COL.CLI.GG_RITARDO + 1)
      .setFormula(FX.cli_ggRitardo(cliSheetRow));
    shC.getRange(cliSheetRow, COL.CLI.TOT_PENALE + 1)
      .setFormula(FX.cli_totPenale(cliSheetRow)).setNumberFormat(FMT.EURO);

    DB.invalidate(SH.CLIENTI);

    // 6. Crea righe BONUS
    const bookmakers = _getActiveBookmakers();
    const bonusRows = _buildBonusRows(idC, nome, data.operatore, data.referral, bookmakers);

    if (bonusRows.length > 0) {
      const shB = DB.ss().getSheetByName(SH.BONUS);
      let maxBns = DB.maxId(SH.BONUS, PFX.BNS);
      // Assegna ID bonus
      bonusRows.forEach((r, i) => { r[COL.BNS.ID] = mkId(PFX.BNS, ++maxBns, 4); });
      // Batch write
      const firstBnsRow = shB.getLastRow() + 1;
      shB.getRange(firstBnsRow, 1, bonusRows.length, bonusRows[0].length).setValues(bonusRows);
      // Formule batch
      const fCompOp  = bonusRows.map((_, i) => [FX.bns_compOp(firstBnsRow + i)]);
      const fMargine = bonusRows.map((_, i) => [FX.bns_margine(firstBnsRow + i)]);
      shB.getRange(firstBnsRow, COL.BNS.COMP_OP + 1, bonusRows.length, 1)
        .setFormulas(fCompOp).setNumberFormat(FMT.EURO);
      shB.getRange(firstBnsRow, COL.BNS.MARGINE + 1, bonusRows.length, 1)
        .setFormulas(fMargine).setNumberFormat(FMT.EURO);
      DB.invalidate(SH.BONUS);
    }

    // 7. Log
    DB.log('NUOVO CLIENTE', idC, nome,
      `Op:${data.operatore||'?'} | Ref:${data.referral||'—'} | BK:${bonusRows.length} | Drive:${driveUrl?'✅':'—'}`,
      'OK', '');

    return {skip: false, id: idC, nomeCliente: nome, bonusCreati: bonusRows.length, driveUrl};
  }

  // ── FIND DUPLICATE ────────────────────────────────────────────────────
  //    Controlla nome+tel, nome+email, tel+email
  //    Ritorna la riga duplicata o null

  function findDuplicate(data) {
    const nome  = (normNome(data.nome || '')).toLowerCase();
    const tel   = normTel(data.tel || '');
    const email = normEmail(data.email || '');

    return DB.findFirst(SH.CLIENTI, r => {
      const rNome  = (normNome(r[COL.CLI.NOME] || '')).toLowerCase();
      const rTel   = normTel(r[COL.CLI.TEL] || '');
      const rEmail = normEmail(r[COL.CLI.EMAIL] || '');

      const matchNomeTel   = nome && tel   && rNome === nome && rTel === tel;
      const matchNomeEmail = nome && email && rNome === nome && rEmail === email;
      const matchTelEmail  = tel  && email && rTel === tel   && rEmail === email;

      return matchNomeTel || matchNomeEmail || matchTelEmail;
    });
  }

  // ── GET PROFILE ───────────────────────────────────────────────────────

  function get(id) {
    const found = DB.findById(SH.CLIENTI, id);
    if (!found) return null;
    const bonuses = DB.findByCol(SH.BONUS, COL.BNS.ID_CLI, id);
    const tasks   = DB.findByCol(SH.TASK,  COL.TSK.ID_CLI, id);
    const docs    = DB.findByCol(SH.DOCUMENTI, COL.DOC.ID_CLI, id);
    return {
      client:  found.row,
      bonuses,
      tasks,
      docs,
      sheetRow: found.sheetRow,
    };
  }

  // ── UPDATE ────────────────────────────────────────────────────────────
  //    updates: oggetto {COL.CLI.CAMPO: valore}

  function update(id, updates) {
    const found = DB.findById(SH.CLIENTI, id);
    if (!found) throw new Error(`Cliente non trovato: ${id}`);
    DB.update(SH.CLIENTI, found.sheetRow, updates);
    DB.log('AGGIORNAMENTO', id, found.row[COL.CLI.NOME],
      'Campi: ' + Object.keys(updates).join(', '), 'OK', '');
    return true;
  }

  // ── SEARCH ────────────────────────────────────────────────────────────

  function search(query) {
    if (!query || query.toString().trim() === '') return [];
    const q = query.toString().toLowerCase().trim();
    const qTel = normTel(q);
    return DB.find(SH.CLIENTI, r => {
      if (!r[COL.CLI.ID]) return false;
      return (
        (r[COL.CLI.NOME] || '').toLowerCase().includes(q) ||
        normTel(r[COL.CLI.TEL]).includes(qTel) ||
        (r[COL.CLI.EMAIL] || '').toLowerCase().includes(q) ||
        (r[COL.CLI.ID] || '').toLowerCase().includes(q) ||
        (r[COL.CLI.COLLAB] || '').toLowerCase().includes(q)
      );
    });
  }

  // ── REGISTER ACCEPTANCE ───────────────────────────────────────────────

  function registerAcceptance(id, dataAcc, note) {
    const found = DB.findById(SH.CLIENTI, id);
    if (!found) return {ok: false, err: `Cliente ${id} non trovato`};

    const nomeC = found.row[COL.CLI.NOME];
    const accDate = dataAcc || new Date();
    const scad48h = new Date(accDate.getTime() + CFG.ORE_PRIMA_OP * 3600 * 1000);

    DB.update(SH.CLIENTI, found.sheetRow, {
      [COL.CLI.DATA_ACC]:   accDate,
      [COL.CLI.STATO_ACC]:  'Accettato',
      [COL.CLI.PENALE_ATT]: 'No',
    });

    // Crea task prima operazione
    if (typeof Task !== 'undefined') {
      Task.create({
        tipo:      'PRIMA OPERAZIONE',
        prio:      'ALTA',
        idCli:     id,
        nomeCli:   nomeC,
        operatore: found.row[COL.CLI.OPERATORE],
        desc:      `${nomeC} ha accettato le condizioni il ${fmtDate(accDate)}. ` +
                   `Prima operazione entro: ${fmtDateTime(scad48h)}.` +
                   (note ? ` Note: ${note}` : ''),
        scadenza:  scad48h,
      });
    }

    DB.log('ACCETTAZIONE', id, nomeC,
      `Data: ${fmtDate(accDate)}${note ? ' | ' + note : ''}`, 'OK', '');

    return {ok: true, id, nomeCliente: nomeC, scadenza48h: scad48h};
  }

  // ── ADD MISSING BONUS ─────────────────────────────────────────────────
  //    Aggiunge bookmaker mancanti per un cliente esistente
  //    Usato quando si aggiunge un nuovo bookmaker al sistema

  function addMissingBonus(id) {
    const found = DB.findById(SH.CLIENTI, id);
    if (!found) return 0;
    const nomeC    = found.row[COL.CLI.NOME];
    const operatore = found.row[COL.CLI.OPERATORE];
    const referral  = found.row[COL.CLI.REFERRAL];

    const existing = DB.findByCol(SH.BONUS, COL.BNS.ID_CLI, id)
      .map(r => normBK(r[COL.BNS.BK]));

    const missing = _getActiveBookmakers()
      .filter(bk => !existing.includes(normBK(bk.nome)));

    if (missing.length === 0) return 0;

    const newRows = _buildBonusRows(id, nomeC, operatore, referral, missing);
    const shB = DB.ss().getSheetByName(SH.BONUS);
    let maxBns = DB.maxId(SH.BONUS, PFX.BNS);
    newRows.forEach(r => { r[COL.BNS.ID] = mkId(PFX.BNS, ++maxBns, 4); });

    const firstRow = shB.getLastRow() + 1;
    shB.getRange(firstRow, 1, newRows.length, newRows[0].length).setValues(newRows);
    const fC = newRows.map((_, i) => [FX.bns_compOp(firstRow + i)]);
    const fM = newRows.map((_, i) => [FX.bns_margine(firstRow + i)]);
    shB.getRange(firstRow, COL.BNS.COMP_OP + 1, newRows.length, 1).setFormulas(fC).setNumberFormat(FMT.EURO);
    shB.getRange(firstRow, COL.BNS.MARGINE + 1, newRows.length, 1).setFormulas(fM).setNumberFormat(FMT.EURO);

    DB.invalidate(SH.BONUS);
    DB.log('BONUS AGGIUNTI', id, nomeC, `${missing.length} bookmaker aggiunti`, 'OK', '');
    return missing.length;
  }

  // ── ADD BOOKMAKER TO ALL CLIENTS ──────────────────────────────────────

  function addBookmakerToAll(nomeBookmaker) {
    const bkNorm = normBK(nomeBookmaker);
    const allClienti = DB.read(SH.CLIENTI);
    const allBonus   = DB.read(SH.BONUS);

    const bkInfo = BOOKMAKERS.find(b => b.nome === bkNorm) ||
                   {nome: bkNorm, tier: 'B', rMin: 0, rMax: 0};

    const shB = DB.ss().getSheetByName(SH.BONUS);
    let maxBns = DB.maxId(SH.BONUS, PFX.BNS);
    const nuoveRighe = [];
    let firstRow = shB.getLastRow() + 1;

    allClienti.forEach(r => {
      if (!r[COL.CLI.ID]) return;
      const haBk = allBonus.some(b =>
        b[COL.BNS.ID_CLI] === r[COL.CLI.ID] &&
        normBK(b[COL.BNS.BK]) === bkNorm
      );
      if (haBk) return;

      const newRow = _buildBonusRows(
        r[COL.CLI.ID], r[COL.CLI.NOME],
        r[COL.CLI.OPERATORE], r[COL.CLI.REFERRAL],
        [bkInfo]
      )[0];
      newRow[COL.BNS.ID] = mkId(PFX.BNS, ++maxBns, 4);
      nuoveRighe.push(newRow);
    });

    if (nuoveRighe.length === 0) return 0;

    shB.getRange(firstRow, 1, nuoveRighe.length, nuoveRighe[0].length).setValues(nuoveRighe);
    const fC = nuoveRighe.map((_, i) => [FX.bns_compOp(firstRow + i)]);
    const fM = nuoveRighe.map((_, i) => [FX.bns_margine(firstRow + i)]);
    shB.getRange(firstRow, COL.BNS.COMP_OP + 1, nuoveRighe.length, 1).setFormulas(fC).setNumberFormat(FMT.EURO);
    shB.getRange(firstRow, COL.BNS.MARGINE + 1, nuoveRighe.length, 1).setFormulas(fM).setNumberFormat(FMT.EURO);

    DB.invalidate(SH.BONUS);
    return nuoveRighe.length;
  }

  // ── DRIVE FOLDER ──────────────────────────────────────────────────────

  function createDriveFolder(idC, nomeC) {
    const ROOT = CFG.DRIVE_ROOT;
    const it = DriveApp.getFoldersByName(ROOT);
    const root = it.hasNext() ? it.next() : DriveApp.createFolder(ROOT);
    const nomeCarta = `${idC} — ${nomeC}`;
    const ck = root.getFoldersByName(nomeCarta);
    if (ck.hasNext()) return ck.next().getUrl();
    const f = root.createFolder(nomeCarta);
    f.createFolder('📄 Documenti Identità');
    f.createFolder('📋 Contratti');
    f.createFolder('📝 Note e Screenshot');
    return f.getUrl();
  }

  // ── GET OPERATOR PERCENTAGE ───────────────────────────────────────────

  function getOperatorPerc(name) {
    return _opPerc(name);
  }

  // ── UPDATE OPERATOR PERC IN BONUS ────────────────────────────────────
  //    Aggiorna la % operatore in tutti i bonus di un operatore

  function syncOperatorPerc(operName) {
    const perc = _opPerc(operName);
    const shB  = DB.ss().getSheetByName(SH.BONUS);
    const data = DB.read(SH.BONUS);
    data.forEach((r, i) => {
      if ((r[COL.BNS.OPERATORE] || '').trim().toLowerCase() === operName.toLowerCase()) {
        shB.getRange(i + 2, COL.BNS.PERC_OP + 1).setValue(perc);
      }
    });
    DB.invalidate(SH.BONUS);
  }

  // ── CALCOLA COSTO REFERRAL ────────────────────────────────────────────

  function calcReferralCost(referralNome) {
    if (!referralNome) return 0;
    const completati = DB.find(SH.CLIENTI, r =>
      (r[COL.CLI.REFERRAL] || '').toLowerCase() === referralNome.toLowerCase() &&
      r[COL.CLI.STATO] === 'COMPLETATO'
    ).length;
    return calcRefTier(completati);
  }

  // ── EXPOSE ───────────────────────────────────────────────────────────

  return {
    create,
    findDuplicate,
    get,
    update,
    search,
    registerAcceptance,
    addMissingBonus,
    addBookmakerToAll,
    createDriveFolder,
    getOperatorPerc,
    syncOperatorPerc,
    calcReferralCost,
  };

})();
