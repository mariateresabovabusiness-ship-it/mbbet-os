// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 08_DOCUMENTS.gs
//   Documenti — tracking upload, Drive folders, link
//   v3.0
// ═══════════════════════════════════════════════════════════════════════

const Documents = (() => {

  const TIPI_DOC = ['CI_FRONTE','CI_RETRO','TS_FRONTE','TS_RETRO','SELFIE','ALTRO'];

  // ══════════════════════════════════════════════════════════════════
  // REGISTRA DOCUMENTO
  // ══════════════════════════════════════════════════════════════════

  function registra(idCli, tipo, driveUrl, note) {
    const c = DB.findById(SH.CLIENTI, idCli);
    if (!c) return { ok: false, err: `Cliente ${idCli} non trovato` };

    const shD  = DB.ss().getSheetByName(SH.DOCUMENTI);
    const idDoc = DB.nextId(SH.DOCUMENTI, PFX.DOC, 5);
    const row  = new Array(COL.DOC._N).fill('');
    row[COL.DOC.ID]          = idDoc;
    row[COL.DOC.ID_CLI]      = idCli;
    row[COL.DOC.NOME_CLI]    = c.row[COL.CLI.NOME];
    row[COL.DOC.TIPO]        = tipo;
    row[COL.DOC.DRIVE_URL]   = driveUrl || '';
    row[COL.DOC.DATA]        = new Date();
    row[COL.DOC.OPERATORE]   = c.row[COL.CLI.OPERATORE];
    row[COL.DOC.NOTE]        = note || '';

    const riga = shD.getLastRow() + 1;
    shD.getRange(riga, 1, 1, row.length).setValues([row]);
    shD.getRange(riga, COL.DOC.DATA + 1).setNumberFormat(FMT.DATA);
    if (driveUrl) {
      shD.getRange(riga, COL.DOC.DRIVE_URL + 1)
        .setFormula(`=HYPERLINK("${driveUrl}","📎 Apri")`).setFontColor('#60a5fa');
    }

    DB.invalidate(SH.DOCUMENTI);
    DB.log('DOC', idDoc, c.row[COL.CLI.NOME], `Tipo: ${tipo}`, 'OK', '');
    return { ok: true, id: idDoc };
  }

  // ══════════════════════════════════════════════════════════════════
  // GET BY CLIENTE
  // ══════════════════════════════════════════════════════════════════

  function getByCliente(idCli) {
    return DB.find(SH.DOCUMENTI, r => r[COL.DOC.ID_CLI] === idCli);
  }

  // ══════════════════════════════════════════════════════════════════
  // STATO COMPLETEZZA DOCUMENTI
  // ══════════════════════════════════════════════════════════════════

  function statoCompletezza(idCli) {
    const docs = getByCliente(idCli);
    const tipiPresenti = new Set(docs.map(d => d[COL.DOC.TIPO]));
    const required = ['CI_FRONTE','CI_RETRO','TS_FRONTE','TS_RETRO','SELFIE'];
    const mancanti = required.filter(t => !tipiPresenti.has(t));
    return {
      completo: mancanti.length === 0,
      mancanti,
      presenti: [...tipiPresenti],
      nDocs: docs.length,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // CREA CARTELLA DRIVE — (chiamata anche da Client.create)
  // ══════════════════════════════════════════════════════════════════

  function createDriveFolder(idCli, nomeCli) {
    try {
      const rootName = CFG.DRIVE_ROOT;
      let rootFolder;
      const rootSearch = DriveApp.getFoldersByName(rootName);
      if (rootSearch.hasNext()) {
        rootFolder = rootSearch.next();
      } else {
        rootFolder = DriveApp.createFolder(rootName);
      }
      const folderName = `${idCli} — ${nomeCli}`;
      // Evita duplicati
      const existing = rootFolder.getFoldersByName(folderName);
      if (existing.hasNext()) return existing.next().getUrl();
      const newFolder = rootFolder.createFolder(folderName);
      // Sottocartelle standard
      ['📋 Contratti', '📁 Documenti ID', '📊 Screenshot Bonus'].forEach(sub => {
        newFolder.createFolder(sub);
      });
      return newFolder.getUrl();
    } catch (e) {
      console.warn(`createDriveFolder failed for ${idCli}: ${e.message}`);
      return '';
    }
  }

  // ── EXPOSE ────────────────────────────────────────────────────────
  return { registra, getByCliente, statoCompletezza, createDriveFolder, TIPI_DOC };

})();
