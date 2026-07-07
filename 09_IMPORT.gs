// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 09_IMPORT.gs
//   Import Module — Vecchio form + Nuovo form (trigger)
//   v3.0
// ═══════════════════════════════════════════════════════════════════════
//
//   Funzioni principali:
//   Import.fromOldForm()      → importa i 200 clienti dal vecchio Google Form
//   Import.onFormSubmit(e)    → trigger automatico per nuovi form
//   Import.installTrigger()   → installa il trigger onFormSubmit
//   Import.runStatusReport()  → mostra report ultimo import
// ═══════════════════════════════════════════════════════════════════════

const Import = (() => {

  // ── Nomi foglio risposte form (prova in ordine) ───────────────────────
  const OLD_FORM_SHEETS = [
    'Risposte del modulo 1',
    'Form Responses 1',
    'Risposte',
    'Responses',
    'Modulo 1 (Risposte)',
  ];

  // ── Trova il foglio risposte del vecchio form ─────────────────────────

  function _findOldFormSheet() {
    const ss = DB.ss();
    for (const nome of OLD_FORM_SHEETS) {
      const sh = ss.getSheetByName(nome);
      if (sh) return sh;
    }
    // Cerca per pattern: foglio con "rispost" o "response" nel nome
    const tutti = ss.getSheets();
    for (const sh of tutti) {
      const n = sh.getName().toLowerCase();
      if (n.includes('rispost') || n.includes('response') || n.includes('modulo')) {
        return sh;
      }
    }
    return null;
  }

  // ── Parsing riga vecchio form → oggetto data ─────────────────────────
  //    OF.* definito in 01_CONSTANTS.gs (1-based → converti a 0-based)

  function _parseOldRow(row) {
    const get = (col1based) => (row[col1based - 1] || '').toString().trim();

    // Normalizza siti già registrati → lista di BK normalizzati
    const sitiRaw = get(OF.SITI_REGISTRATI);
    const sitiList = sitiRaw
      .split(/[,;\/\n]/)
      .map(s => normBK(s.trim()))
      .filter(s => s.length > 0);

    // Determina tipologia
    let tipologia = 'ORGANICO';
    const rawRef = get(OF.REFERRAL);
    const rawDiChi = get(OF.DI_CHI);
    if (rawRef && rawRef.toLowerCase() !== 'no' && rawRef.toLowerCase() !== 'nessuno') {
      tipologia = 'REFERRAL';
    }

    return {
      timestamp:    get(OF.TIMESTAMP) ? new Date(get(OF.TIMESTAMP)) : new Date(),
      nome:         get(OF.NOME),
      email:        get(OF.EMAIL),
      emailSiti:    get(OF.EMAIL_SITI),
      tel:          get(OF.TELEFONO),
      referral:     rawRef !== 'no' && rawRef !== 'nessuno' ? rawRef : '',
      diChi:        rawDiChi,
      nuovoVec:     get(OF.NUOVO_VECCHIO).toLowerCase().includes('già') ? 'Già Cliente' : 'Nuovo',
      spid:         get(OF.SPID),
      cc:           get(OF.CONTO_CORRENTE),
      operatore:    get(OF.OPERATORE),
      tipologia,
      mese:         get(OF.MESE),
      sitiGiaReg:   sitiList,   // bookmaker già registrati prima di MBBET
      dataIngresso: get(OF.TIMESTAMP) ? new Date(get(OF.TIMESTAMP)) : new Date(),
      note:         `Form vecchio — ${get(OF.INSTAGRAM) ? 'IG: ' + get(OF.INSTAGRAM) : ''}`.trim(),
      // Link documenti (potrebbero essere URL Drive)
      docs: {
        ciFronte:    get(OF.CI_FRONTE),
        ciRetro:     get(OF.CI_RETRO),
        tsFronte:    get(OF.TS_FRONTE),
        tsRetro:     get(OF.TS_RETRO),
        fotoFronte:  get(OF.FOTO_FRONTE),
      },
    };
  }

  // ── Parsing riga NUOVO form → oggetto data ────────────────────────────
  //    NF.* da aggiornare quando crei il nuovo form in Google Forms
  //    Per ora usa le stesse colonne del vecchio form come fallback

  function _parseNewRow(row) {
    // Struttura del nuovo form (adatta quando crei il form)
    const get = (col1based) => (row[col1based - 1] || '').toString().trim();
    return {
      timestamp:    new Date(),
      nome:         get(2),
      tel:          get(3),
      email:        get(4),
      emailSiti:    get(5),
      spid:         get(6),
      cc:           get(7),
      sitiGiaReg:   get(8).split(',').map(s => normBK(s.trim())).filter(Boolean),
      referral:     get(9),
      nuovoVec:     get(10).toLowerCase().includes('già') ? 'Già Cliente' : 'Nuovo',
      tipologia:    get(9) ? 'REFERRAL' : 'ORGANICO',
      operatore:    get(17) || '',
      mese:         Utilities.formatDate(new Date(), CFG.TIMEZONE, 'MM/yyyy'),
      dataIngresso: new Date(),
      note:         '',
      docs:         {},
    };
  }

  // ── Registra documenti dopo import ────────────────────────────────────

  function _importDocs(idC, nomeC, docs) {
    const docsMap = [
      {tipo: 'CI Fronte',    link: docs.ciFronte},
      {tipo: 'CI Retro',     link: docs.ciRetro},
      {tipo: 'TS Fronte',    link: docs.tsFronte},
      {tipo: 'TS Retro',     link: docs.tsRetro},
      {tipo: 'Selfie',       link: docs.fotoFronte},
    ];

    const shD = DB.ss().getSheetByName(SH.DOCUMENTI);
    if (!shD) return;
    let maxDoc = DB.maxId(SH.DOCUMENTI, PFX.DOC);

    const righe = docsMap
      .filter(d => d.link && d.link.startsWith('http'))
      .map(d => {
        const row = new Array(COL.DOC._N).fill('');
        row[COL.DOC.ID]       = mkId(PFX.DOC, ++maxDoc, 5);
        row[COL.DOC.ID_CLI]   = idC;
        row[COL.DOC.NOME_CLI] = nomeC;
        row[COL.DOC.TIPO]     = d.tipo;
        row[COL.DOC.LINK]     = d.link;
        row[COL.DOC.DATA_UP]  = new Date();
        row[COL.DOC.STATO]    = 'Presente';
        row[COL.DOC.NOTE]     = 'Importato da vecchio form';
        return row;
      });

    if (righe.length > 0) {
      shD.getRange(shD.getLastRow() + 1, 1, righe.length, righe[0].length).setValues(righe);
      DB.invalidate(SH.DOCUMENTI);
    }
  }

  // ── Aggiorna stato bookmaker già registrati ────────────────────────────
  //    Se il cliente aveva già registrato un BK prima di MBBET → GIÀ REGISTRATO

  function _markAlreadyRegistered(idC, sitiGiaReg) {
    if (!sitiGiaReg || sitiGiaReg.length === 0) return;
    const shB = DB.ss().getSheetByName(SH.BONUS);
    const data = DB.read(SH.BONUS);
    data.forEach((r, i) => {
      if (r[COL.BNS.ID_CLI] !== idC) return;
      const bkNorm = normBK(r[COL.BNS.BK]);
      if (sitiGiaReg.map(s => normBK(s)).includes(bkNorm)) {
        shB.getRange(i + 2, COL.BNS.STATO + 1).setValue('GIÀ REGISTRATO');
      }
    });
    DB.invalidate(SH.BONUS);
  }

  // ════════════════════════════════════════════════════════════════════
  // IMPORT DAL VECCHIO FORM
  // ════════════════════════════════════════════════════════════════════

  function fromOldForm() {
    const ui = SpreadsheetApp.getUi();
    const shRisp = _findOldFormSheet();

    if (!shRisp) {
      ui.alert('❌  Foglio risposte non trovato',
        'Non trovo il foglio con le risposte del vecchio form.\n\n' +
        'Deve chiamarsi "Risposte del modulo 1" o simile.\n\n' +
        'SOLUZIONE:\n' +
        '1. Apri il vecchio Google Form\n' +
        '2. Tab "Risposte" → icona verde (Sheets) → "Crea foglio"\n' +
        '3. Scegli questo stesso foglio come destinazione\n' +
        '4. Riprova l\'import',
        ui.ButtonSet.OK);
      return;
    }

    const lastRow = shRisp.getLastRow();
    if (lastRow <= 1) {
      ui.alert('⚠️  Foglio vuoto', `Il foglio "${shRisp.getName()}" non contiene risposte.`, ui.ButtonSet.OK);
      return;
    }

    // Conferma
    const nRighe = lastRow - 1;
    const ok = ui.alert('📥  Importa ' + nRighe + ' Clienti',
      `Trovate ${nRighe} risposte nel foglio "${shRisp.getName()}".\n\n` +
      'Il sistema creerà:\n' +
      `• ${nRighe} clienti (duplicati ignorati)\n` +
      `• ~${nRighe * BOOKMAKERS.filter(b=>b.attivo).length} righe bonus\n` +
      '• Cartelle Drive per ogni cliente\n' +
      '• Documenti registrati dove disponibili\n\n' +
      '⏱️  Tempo stimato: 3-8 minuti\n\n' +
      'Continuare?',
      ui.ButtonSet.YES_NO);
    if (ok !== ui.Button.YES) return;

    // Log avvio
    DB.log('IMPORT AVVIO', '', '', `Foglio: ${shRisp.getName()} | ${nRighe} righe`, 'INFO', '');

    const allRows = shRisp.getRange(2, 1, nRighe, shRisp.getLastColumn()).getValues();

    let creati = 0, saltati = 0, errori = 0;
    const errLog = [];
    const risultati = [];  // per il report finale

    allRows.forEach((row, i) => {
      try {
        const data = _parseOldRow(row);
        if (!data.nome) { saltati++; return; }

        const result = Client.create(data);

        if (result.skip) {
          saltati++;
          risultati.push({tipo: 'DUP', id: result.id, nome: result.nomeCliente});
        } else {
          creati++;
          risultati.push({tipo: 'OK', id: result.id, nome: result.nomeCliente, bk: result.bonusCreati});
          // Registra documenti (se presenti)
          if (data.docs) _importDocs(result.id, result.nomeCliente, data.docs);
          // Marca siti già registrati
          if (data.sitiGiaReg.length > 0) _markAlreadyRegistered(result.id, data.sitiGiaReg);
        }

        // Progress toast ogni 20 clienti
        if ((creati + saltati + errori) % 20 === 0) {
          SpreadsheetApp.getUi().showToast(
            `Elaborati ${creati + saltati + errori} / ${nRighe}...`,
            '📥 Import', 10
          );
        }

      } catch (e) {
        errori++;
        errLog.push(`Riga ${i+2}: ${e.message}`);
        DB.log('ERRORE IMPORT', '', (row[OF.NOME-1]||'?'), `Riga ${i+2}`, 'ERRORE', e.message);
      }
    });

    // Log completamento
    DB.log('IMPORT COMPLETATO', '', '',
      `Creati: ${creati} | Saltati: ${saltati} dup. | Errori: ${errori}`, 'OK', '');

    // Salva risultato su foglio IMPORT per riferimento
    _saveImportReport(risultati, nRighe, creati, saltati, errori);

    // Mostra risultato all'utente
    const bkTotali = risultati.filter(r=>r.tipo==='OK').reduce((s,r)=>s+(r.bk||0),0);
    ui.alert('✅  Import Completato!',
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ Clienti importati:    ${creati}\n` +
      `⏭️  Duplicati saltati:   ${saltati}\n` +
      `❌ Errori:              ${errori}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 Righe bonus create:  ${bkTotali}\n` +
      (errori > 0 ? `\n⚠️  Errori: vedi foglio 📥 IMPORT per dettagli.` : '') +
      `\n\nPROSSIMO PASSO:\n` +
      `Menu → 🔧 Analizza Clienti Incompleti\n` +
      `per vedere cosa manca per ogni cliente.`,
      ui.ButtonSet.OK);
  }

  // ── Salva report import su foglio IMPORT ─────────────────────────────

  function _saveImportReport(risultati, tot, creati, saltati, errori) {
    let shImp = DB.ss().getSheetByName(SH.IMPORT);
    if (!shImp) return;

    shImp.clearContents();
    const ts = Utilities.formatDate(new Date(), CFG.TIMEZONE, 'dd/MM/yyyy HH:mm');
    shImp.getRange(1,1).setValue(`REPORT IMPORT — ${ts}`).setFontWeight('bold');
    shImp.getRange(2,1).setValue(`Totale righe: ${tot} | Creati: ${creati} | Saltati: ${saltati} | Errori: ${errori}`);
    shImp.getRange(4,1,1,4).setValues([['Tipo','ID','Nome','BK Creati']]).setFontWeight('bold');
    if (risultati.length > 0) {
      shImp.getRange(5,1,risultati.length,4).setValues(
        risultati.map(r=>[r.tipo, r.id||'', r.nome||'', r.bk||''])
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // TRIGGER NUOVO FORM — onFormSubmit
  // ════════════════════════════════════════════════════════════════════

  function onFormSubmit(e) {
    try {
      if (!e || !e.values) return;
      const row = e.values;  // array 0-based dei valori del form

      // Converti a 1-based per compatibilità con _parseNewRow
      const data = _parseNewRow([''].concat(row)); // aggiungi elemento vuoto per shift a 1-based

      if (!data.nome) {
        DB.log('FORM SUBMIT', '', '', 'Nome mancante — ignorato', 'WARN', '');
        return;
      }

      const result = Client.create(data);

      if (result.skip) {
        DB.log('FORM SUBMIT DUP', result.id, result.nomeCliente, 'Duplicato rilevato', 'SKIP', '');
      } else {
        DB.log('FORM SUBMIT', result.id, result.nomeCliente,
          `${result.bonusCreati} bookmaker | Drive: ${result.driveUrl ? '✅' : '—'}`, 'OK', '');
        // Invia email di benvenuto (opzionale, abilitabile da CONFIG)
        const sendWelcome = DB.config('Email benvenuto') === 'Sì';
        if (sendWelcome && data.email) {
          _sendWelcomeEmail(result.id, data.nome, data.email, result.operatore);
        }
      }
    } catch (err) {
      DB.log('ERR FORM SUBMIT', '', '', err.message, 'ERRORE', err.toString());
    }
  }

  // ── Email di benvenuto (opzionale) ───────────────────────────────────

  function _sendWelcomeEmail(id, nome, email, operatore) {
    try {
      MailApp.sendEmail({
        to: email,
        subject: `Benvenuto in MBBET — Registrazione confermata`,
        htmlBody: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#0a0e1a;color:#e2e8f0;border-radius:8px;">
          <h2 style="color:#f5c842;">🎯 Benvenuto in MBBET, ${nome.split(' ')[0]}!</h2>
          <p>La tua registrazione è confermata.</p>
          <p>Il tuo operatore di riferimento ti contatterà al più presto per iniziare.</p>
          <p style="color:#64748b;font-size:12px;">ID: ${id}</p>
          <hr style="border-color:#1e2a3a;">
          <p style="font-size:11px;color:#334155;">MBBET — Sistema professionale di match betting</p>
        </div>`
      });
    } catch (_) { /* silenzioso */ }
  }

  // ════════════════════════════════════════════════════════════════════
  // INSTALLA TRIGGER
  // ════════════════════════════════════════════════════════════════════

  function installTrigger() {
    const ui = SpreadsheetApp.getUi();

    // Rimuovi vecchi trigger onFormSubmit
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getHandlerFunction() === 'onFormSubmit') ScriptApp.deleteTrigger(t);
    });

    // Installa nuovo
    ScriptApp.newTrigger('onFormSubmit')
      .forSpreadsheet(DB.ss())
      .onFormSubmit()
      .create();

    DB.log('TRIGGER', '', '', 'onFormSubmit installato', 'OK', '');

    ui.alert('✅  Trigger Installato!',
      'Da ora ogni nuova risposta al form crea automaticamente:\n' +
      '• Il cliente nel CRM\n' +
      '• Tutte le righe bonus per ogni bookmaker\n' +
      '• La cartella Drive\n\n' +
      'Zero intervento manuale richiesto.',
      ui.ButtonSet.OK);
  }

  // ════════════════════════════════════════════════════════════════════
  // ESPORTA
  // ════════════════════════════════════════════════════════════════════

  return {
    fromOldForm,
    onFormSubmit,
    installTrigger,
  };

})();

// ── Funzione globale per trigger Apps Script ──────────────────────────
//    Il trigger deve puntare a una funzione globale, non a Import.onFormSubmit

function onFormSubmit(e) {
  Import.onFormSubmit(e);
}
