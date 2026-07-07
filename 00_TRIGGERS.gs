// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 00_TRIGGERS.gs
//   Triggers — onOpen, onEdit, onFormSubmit + Menu completo
//   v3.0
//
//   ⚠️  QUESTO FILE VIENE CARICATO PRIMA DI TUTTI GLI ALTRI.
//       Il prefisso "00_" garantisce l'ordine in Apps Script.
//       Non spostare e non rinominare.
// ═══════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// onOpen — Menu principale
// ════════════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎯 MBBET CRM')

    // ── Sezione principale ────────────────────────────────────────
    .addItem('🌅  Cosa Fare Oggi',             'menuCosaDaFareOggi')
    .addItem('🔍  Cerca Cliente',              'menuCercaCliente')
    .addSeparator()

    // ── Setup ─────────────────────────────────────────────────────
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('⚙️  Setup e Installazione')
        .addItem('⚙️  Setup Completo CRM',              'setupCRM')
        .addItem('🏠  Aggiorna Home',                   'menuRebuildHome')
        .addItem('📊  Aggiorna Dashboard',              'menuRebuildDashboard')
        .addSeparator()
        .addItem('🔧  Installa Trigger Form (auto-clienti)', 'menuInstallFormTrigger')
        .addItem('🤖  Installa Agente 08:00',           'menuInstallDailyAgent')
        .addItem('🔒  Proteggi Fogli Database',          'menuProteggiDB')
    )
    .addSeparator()

    // ── Clienti ──────────────────────────────────────────────────
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('👥  Clienti')
        .addItem('📥  Importa 200 Clienti (vecchio form)',  'menuImportaClienti')
        .addItem('✅  Registra Accettazione Condizioni',   'menuRegistraAccettazione')
        .addItem('🔧  Analizza Clienti Incompleti',        'menuAnalizzaIncompleti')
        .addItem('➕  Aggiungi Nuovo Bookmaker a Tutti',   'menuAddBookmakerATutti')
    )

    // ── Collab ────────────────────────────────────────────────────
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('🤝  Collaboratori')
        .addItem('🤝  Crea Nuova Collab',      'menuCreaCollab')
        .addItem('📊  Aggiorna Collab Dash',   'menuRebuildCollabDash')
    )

    // ── Finanze ───────────────────────────────────────────────────
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('💸  Finanze e Penali')
        .addItem('💸  Registra Pagamento',         'menuRegistraPagamento')
        .addItem('⚠️  Calcola Penali Ritardi',     'menuCalcolaPenali')
    )
    .addSeparator()

    // ── Agenti ───────────────────────────────────────────────────
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('🤖  Agenti e Automazione')
        .addItem('🤖  Lancia Agente Ora',          'menuLanciaAgente')
        .addItem('📋  Genera Task Operatori',      'menuGeneraTask')
        .addItem('📧  Invia Report Email Adesso',  'menuInviaReport')
    )
    .addSeparator()

    // ── Utility ──────────────────────────────────────────────────
    .addItem('🔍  Verifica Sistema',              'menuVerificaSistema')
    .addItem('📝  Log Ultimi 20 Eventi',          'menuShowLog')
    .addItem('❓  Struttura Nuovo Form',          'menuStrutturaForm')

    .addToUi();
}

// ════════════════════════════════════════════════════════════════════
// onEdit — unico handler per tutti i fogli
// ════════════════════════════════════════════════════════════════════

function onEdit(e) {
  if (!e) return;
  const range = e.range;
  const sh    = range.getSheet();
  const nome  = sh.getName();
  const col   = range.getColumn();
  const row   = range.getRow();
  const val   = e.value;

  try {
    // ── RICERCA: riga 3, col 1 → cerca cliente ─────────────────
    if (nome === SH.RICERCA && row === 3 && col === 1) {
      Utilities.sleep(300);
      if (typeof Search !== 'undefined') Search.run();
      return;
    }

    // ── HOME PANNELLO: colonna 2 = checkbox → dispatch ──────────
    if (nome === SH.HOME && col === 2 && val === 'TRUE') {
      range.setValue(false);
      SpreadsheetApp.flush();
      if (typeof HomePanel !== 'undefined') HomePanel.dispatch(row);
      return;
    }

    // ── BONUS: cambia stato → aggiorna data ultima azione ───────
    if (nome === SH.BONUS && col === COL.BNS.STATO + 1 && row >= 2) {
      sh.getRange(row, COL.BNS.ULT_AZ + 1).setValue(new Date())
        .setNumberFormat(FMT.DATA);
      // Colora cella stato
      const stato = val || '';
      const s = STATUS_STYLE[stato];
      if (s) {
        range.setBackground(s.bg).setFontColor(s.fg)
          .setFontWeight(s.bold ? 'bold' : 'normal');
      }
      DB.invalidate(SH.BONUS);
      return;
    }

    // ── TASK: cambia stato → aggiorna colore ────────────────────
    if (nome === SH.TASK && col === COL.TSK.STATO + 1 && row >= 2) {
      const stMap = {
        'Aperto':    {bg:C.RED_BG, fg:C.RED_T},
        'In Corso':  {bg:C.YELLOW_BG, fg:C.YELLOW_T},
        'Fatto':     {bg:C.GREEN_BG, fg:C.GREEN_T},
        'Annullato': {bg:'#f1f5f9', fg:'#475569'},
      };
      const s = stMap[val || ''];
      if (s) range.setBackground(s.bg).setFontColor(s.fg);
      return;
    }

  } catch (err) {
    // Non loggare errori di onEdit per evitare loop
    console.error('onEdit error:', err.message);
  }
}

// ════════════════════════════════════════════════════════════════════
// FUNZIONI MENU — chiamate dal menu (devono essere globali)
// ════════════════════════════════════════════════════════════════════

// ── Setup ────────────────────────────────────────────────────────────

function menuRebuildHome() {
  if (typeof HomeSetup !== 'undefined') HomeSetup.run();
  SpreadsheetApp.getUi().showToast('✅  Home aggiornata!', '🏠', 3);
}

function menuRebuildDashboard() {
  if (typeof Dashboard !== 'undefined') Dashboard.rebuild();
  SpreadsheetApp.getUi().showToast('✅  Dashboard aggiornata!', '📊', 3);
}

function menuInstallFormTrigger() {
  Import.installTrigger();
}

function menuInstallDailyAgent() {
  Agent.installDaily();
}

function menuProteggiDB() {
  const ui = SpreadsheetApp.getUi();
  [SH.CLIENTI, SH.BONUS, SH.COLLAB, SH.PENALI].forEach(nome => {
    const sh = DB.ss().getSheetByName(nome);
    if (!sh) return;
    const p = sh.protect();
    p.setDescription(`Protetto CRM — ${nome}`);
    p.setWarningOnly(true);
  });
  ui.alert('🔒  Protezione Attivata',
    'I fogli CLIENTI, BONUS, COLLAB e PENALI mostrano un avviso prima di modifiche accidentali.',
    ui.ButtonSet.OK);
}

// ── Clienti ──────────────────────────────────────────────────────────

function menuImportaClienti() {
  Import.fromOldForm();
}

function menuRegistraAccettazione() {
  _wizardAccettazione();
}

function menuAnalizzaIncompleti() {
  _analizzaIncompleti();
}

function menuCercaCliente() {
  DB.ss().setActiveSheet(DB.ss().getSheetByName(SH.RICERCA));
  SpreadsheetApp.getUi().showToast('Scrivi nome, telefono o email in cella A3', '🔍', 5);
}

function menuAddBookmakerATutti() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('➕  Aggiungi Bookmaker a Tutti',
    'Nome del nuovo bookmaker da aggiungere a tutti i clienti esistenti:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const nome = resp.getResponseText().trim();
  if (!nome) return;
  const n = Client.addBookmakerToAll(nome);
  ui.alert('✅  Fatto!', `Aggiunte ${n} nuove righe bonus per "${nome}".`, ui.ButtonSet.OK);
}

// ── Collab ────────────────────────────────────────────────────────────

function menuCreaCollab() {
  _wizardCreaCollab();
}

function menuRebuildCollabDash() {
  if (typeof Dashboard !== 'undefined') Dashboard.rebuildCollab();
  SpreadsheetApp.getUi().showToast('✅  Collab Dashboard aggiornata!', '📊', 3);
}

// ── Finanze ──────────────────────────────────────────────────────────

function menuRegistraPagamento() {
  _wizardPagamento();
}

function menuCalcolaPenali() {
  const n = Agent.calcolaPenali();
  SpreadsheetApp.getUi().alert('⚠️  Penali Aggiornate',
    `Penali calcolate/aggiornate: ${n}\nVedi foglio ⚠️ PENALI per i dettagli.`,
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ── Agenti ───────────────────────────────────────────────────────────

function menuLanciaAgente() {
  Agent.run();
}

function menuGeneraTask() {
  const n = Task.generateDaily();
  SpreadsheetApp.getUi().alert('📋  Task Generati',
    `Nuovi task creati: ${n}\nVedi foglio ✅ TASK.`,
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuInviaReport() {
  Agent.sendEmailReport();
}

// ── Utility ──────────────────────────────────────────────────────────

function menuCosaDaFareOggi() {
  _briefingMattutino();
}

function menuVerificaSistema() {
  _verificaSistema();
}

function menuShowLog() {
  const data = DB.read(SH.LOG).slice(-20).reverse();
  if (data.length === 0) {
    SpreadsheetApp.getUi().alert('📝  Log', 'Nessun evento registrato.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const msg = data.slice(0, 15).map(r =>
    `[${fmtDateTime(r[COL.LOG.TS])}] ${r[COL.LOG.TIPO]} — ${r[COL.LOG.ESITO]}\n${r[COL.LOG.DET] || ''}`
  ).join('\n─────────────────────\n');
  SpreadsheetApp.getUi().alert('📝  Log Ultimi 15 eventi', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuStrutturaForm() {
  SpreadsheetApp.getUi().alert(
    '📋  Struttura Nuovo Form Cliente',
    'SEZIONE 1 — Accettazione (obbligatoria)\n' +
    '□ Accetto le Condizioni Operative MBBET [OBBLIGATORIO]\n' +
    '□ Contributo operativo per ritardo: vedi clausola [OBBLIGATORIO]\n\n' +
    'SEZIONE 2 — Dati Personali\n' +
    '• Nome e Cognome\n• Telefono\n• Email Personale\n• Email per i siti\n\n' +
    'SEZIONE 3 — Info Operative\n' +
    '• Hai SPID attivo? [Sì/No]\n• Conto corrente italiano? [Sì/No]\n' +
    '• Chi ti ha presentato MBBET?\n• Come sei arrivato? [Organico/Referral/Collab]\n' +
    '• Siti già registrati [checkbox bookmaker]\n\n' +
    'SEZIONE 4 — Documenti\n' +
    '• CI Fronte [file upload]\n• CI Retro [file upload]\n' +
    '• TS Fronte [file upload]\n• TS Retro [file upload]\n• Selfie con documento [file upload]\n\n' +
    'SEZIONE 5 — Conferma\n' +
    '□ Autorizzo trattamento dati GDPR [OBBLIGATORIO]\n' +
    '□ Accetto il contributo operativo per ritardo [OBBLIGATORIO]\n\n' +
    'Dopo la creazione → aggiorna NF in 01_CONSTANTS.gs',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ════════════════════════════════════════════════════════════════════
// WIZARD — Funzioni guidate popup
// ════════════════════════════════════════════════════════════════════

function _wizardAccettazione() {
  const ui = SpreadsheetApp.getUi();

  // Passo 1: cerca cliente
  const p1 = ui.prompt('✅ Registra Accettazione — 1/3',
    'Nome, cognome o ID cliente:\nEs: "Mario Rossi"  oppure  "MBBET-042"', ui.ButtonSet.OK_CANCEL);
  if (p1.getSelectedButton() !== ui.Button.OK) return;
  const query = (p1.getResponseText() || '').trim();
  if (!query) return;

  const trovati = Client.search(query);
  if (trovati.length === 0) {
    ui.alert('❌  Non trovato', `Nessun cliente trovato con: "${query}"`, ui.ButtonSet.OK);
    return;
  }

  let cliRow = trovati[0];
  if (trovati.length > 1) {
    const lista = trovati.slice(0, 5).map((r, i) =>
      `${i+1}. ${r[COL.CLI.ID]} — ${r[COL.CLI.NOME]} (${r[COL.CLI.TEL] || 'no tel'})`
    ).join('\n');
    const p1b = ui.prompt('✅ Più clienti trovati — 1b/3',
      `Trovati ${trovati.length}:\n${lista}\n\nInserisci il numero (1-5):`, ui.ButtonSet.OK_CANCEL);
    if (p1b.getSelectedButton() !== ui.Button.OK) return;
    const idx = parseInt(p1b.getResponseText()) - 1;
    if (isNaN(idx) || idx < 0 || idx >= trovati.length) { ui.alert('Numero non valido'); return; }
    cliRow = trovati[idx];
  }

  // Passo 2: data
  const p2 = ui.prompt(
    `✅ Registra Accettazione — 2/3\nCliente: ${cliRow[COL.CLI.NOME]} (${cliRow[COL.CLI.ID]})`,
    'Data accettazione (lascia vuoto = OGGI):\nFormato: GG/MM/AAAA', ui.ButtonSet.OK_CANCEL);
  if (p2.getSelectedButton() !== ui.Button.OK) return;

  let dataAcc = new Date();
  const ds = (p2.getResponseText() || '').trim();
  if (ds) {
    const p = ds.split('/');
    if (p.length === 3) {
      const d = new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
      if (!isNaN(d.getTime())) dataAcc = d;
    }
  }

  // Passo 3: note
  const p3 = ui.prompt(
    `✅ Registra Accettazione — 3/3\nCliente: ${cliRow[COL.CLI.NOME]}`,
    'Note (opzionale):\nEs: "Accettato via WhatsApp con Sere"', ui.ButtonSet.OK_CANCEL);
  if (p3.getSelectedButton() !== ui.Button.OK) return;
  const note = (p3.getResponseText() || '').trim();

  const result = Client.registerAcceptance(cliRow[COL.CLI.ID], dataAcc, note);

  if (!result.ok) {
    ui.alert('❌  Errore', result.err, ui.ButtonSet.OK);
    return;
  }

  ui.alert('✅  Accettazione Registrata!',
    `Cliente: ${result.nomeCliente} (${result.id})\n` +
    `Data: ${fmtDate(dataAcc)}\n` +
    `Scadenza 48h: ${fmtDateTime(result.scadenza48h)}\n` +
    (note ? `Note: ${note}\n` : '') +
    `\n✅ Task "PRIMA OPERAZIONE" creato per l'operatore.`,
    ui.ButtonSet.OK);
}

function _wizardCreaCollab() {
  const ui = SpreadsheetApp.getUi();
  const shC2 = DB.ss().getSheetByName(SH.COLLAB);
  if (!shC2) { ui.alert('⚠️', 'Foglio COLLAB non trovato. Esegui Setup.', ui.ButtonSet.OK); return; }

  const p = [
    ['Nome collaboratore o azienda:', ''],
    ['Contatto (telefono o email):', ''],
    ['Tipo (1=Individuale 2=Azienda 3=Community 4=Influencer):', '1'],
    ['% Compenso (solo numero):', '15'],
    ['Operatore MBBET di riferimento (Manu/Sere/Samu/Mary):', ''],
  ];

  const risposte = [];
  for (let i = 0; i < p.length; i++) {
    const r = ui.prompt(`🤝 Nuova Collab — ${i+1}/${p.length}`, p[i][0], ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    risposte.push((r.getResponseText() || p[i][1]).trim());
  }

  const tipoMap = {'1':'Individuale','2':'Azienda','3':'Community','4':'Influencer'};
  const nome     = risposte[0];
  const contatto = risposte[1];
  const tipo     = tipoMap[risposte[2]] || 'Individuale';
  const perc     = parseFloat(risposte[3]) || 15;
  const opRif    = risposte[4];

  if (!nome) { ui.alert('Nome obbligatorio.'); return; }

  const maxNum = DB.maxId(SH.COLLAB, PFX.CLB);
  const idC2   = mkId(PFX.CLB, maxNum + 1, 3);
  const riga   = shC2.getLastRow() + 1;

  const row = new Array(COL.CLB._N).fill('');
  row[COL.CLB.ID]          = idC2;
  row[COL.CLB.NOME]        = nome;
  row[COL.CLB.CONTATTO]    = contatto;
  row[COL.CLB.TIPO]        = tipo;
  row[COL.CLB.OP_RIF]      = opRif;
  row[COL.CLB.PERC]        = perc;
  row[COL.CLB.STATO]       = 'Attiva';
  row[COL.CLB.DATA_INI]    = new Date();
  row[COL.CLB.ULT_ATT]     = new Date();

  shC2.getRange(riga, 1, 1, row.length).setValues([row]);
  // Formule
  shC2.getRange(riga, COL.CLB.CLI_PORTATI + 1)
    .setFormula(FX.clb_cliPortati(riga));
  shC2.getRange(riga, COL.CLB.BNS_COLLEGATI + 1)
    .setFormula(FX.clb_bnsCollegati(riga));
  shC2.getRange(riga, COL.CLB.TOT_RIC + 1)
    .setFormula(FX.clb_totRic(riga)).setNumberFormat(FMT.EURO);
  shC2.getRange(riga, COL.CLB.TOT_COMP + 1)
    .setFormula(FX.clb_totComp(riga)).setNumberFormat(FMT.EURO);
  shC2.getRange(riga, COL.CLB.SALDO + 1)
    .setFormula(FX.clb_saldo(riga)).setNumberFormat(FMT.EURO);

  DB.invalidate(SH.COLLAB);
  DB.log('NUOVA COLLAB', idC2, nome, `${tipo} | ${perc}% | ref: ${opRif||'—'}`, 'OK', '');

  ui.alert('✅  Collab Creata!',
    `ID: ${idC2}\nNome: ${nome}\nTipo: ${tipo}\nCompenso: ${perc}%\n` +
    `Operatore ref.: ${opRif || '—'}\n\n` +
    `Nel foglio 👥 CLIENTI, campo "Collab", inserisci "${nome}" per i clienti portati da questa collab.`,
    ui.ButtonSet.OK);
}

function _wizardPagamento() {
  const ui = SpreadsheetApp.getUi();

  const p1 = ui.prompt('💸 Registra Pagamento — 1/4',
    'A chi paghi? (nome cliente, collab, o operatore):', ui.ButtonSet.OK_CANCEL);
  if (p1.getSelectedButton() !== ui.Button.OK) return;
  const benef = (p1.getResponseText() || '').trim();

  const p2 = ui.prompt('💸 Registra Pagamento — 2/4',
    'Importo in € (solo numero):', ui.ButtonSet.OK_CANCEL);
  if (p2.getSelectedButton() !== ui.Button.OK) return;
  const importo = parseFloat((p2.getResponseText() || '0').replace(',', '.')) || 0;

  const p3 = ui.prompt('💸 Registra Pagamento — 3/4',
    'Tipo:\n1=Cliente  2=Operatore  3=Referral  4=Collab  5=Penale  6=Altro', ui.ButtonSet.OK_CANCEL);
  if (p3.getSelectedButton() !== ui.Button.OK) return;
  const tipoMap2 = {'1':'Cliente','2':'Operatore','3':'Referral','4':'Collab','5':'Penale','6':'Altro'};
  const tipo = tipoMap2[p3.getResponseText().trim()] || 'Altro';

  const p4 = ui.prompt('💸 Registra Pagamento — 4/4',
    'Causale (es: bonus BET365 febbraio):', ui.ButtonSet.OK_CANCEL);
  if (p4.getSelectedButton() !== ui.Button.OK) return;
  const causale = (p4.getResponseText() || '').trim();

  const shP = DB.ss().getSheetByName(SH.PAGAMENTI);
  const idPag = DB.nextId(SH.PAGAMENTI, PFX.PAG, 4);
  const row = new Array(COL.PAG._N).fill('');
  row[COL.PAG.ID]          = idPag;
  row[COL.PAG.DATA]        = new Date();
  row[COL.PAG.NOME_CLI]    = benef;
  row[COL.PAG.TIPO]        = tipo;
  row[COL.PAG.BENEFICIARIO]= benef;
  row[COL.PAG.IMPORTO]     = importo;
  row[COL.PAG.METODO]      = 'Bonifico';
  row[COL.PAG.CAUSALE]     = causale;
  row[COL.PAG.STATO]       = 'Pagato';
  shP.getRange(shP.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  shP.getRange(shP.getLastRow(), COL.PAG.IMPORTO + 1).setNumberFormat(FMT.EURO);
  shP.getRange(shP.getLastRow(), COL.PAG.DATA + 1).setNumberFormat(FMT.DATA);
  DB.invalidate(SH.PAGAMENTI);

  ui.alert('✅  Pagamento Registrato!',
    `ID: ${idPag}\nBeneficiario: ${benef}\nImporto: ${fmtEuro(importo)}\nCausale: ${causale}`,
    ui.ButtonSet.OK);
}

function _analizzaIncompleti() {
  const ui = SpreadsheetApp.getUi();
  const shDA = DB.ss().getSheetByName(SH.DA_FARE);
  if (!shDA) { ui.alert('Foglio DA COMPLETARE non trovato. Esegui Setup.'); return; }

  // Pulisci
  if (shDA.getLastRow() > 2) {
    shDA.getRange(3, 1, shDA.getLastRow() - 2, 13).clearContent().setBackground(null).setFontColor(null);
  }

  const cliData = DB.read(SH.CLIENTI);
  const shC = DB.ss().getSheetByName(SH.CLIENTI);
  const hasV2 = shC.getLastColumn() >= 26;
  const righe = [];
  let alta = 0, media = 0, bassa = 0;

  cliData.forEach(r => {
    if (!r[COL.CLI.ID]) return;
    const mancanti = [];
    const dettaglio = [];

    if (!normTel(r[COL.CLI.TEL]))         { mancanti.push('tel');      dettaglio.push('📵 Telefono'); }
    if (!normEmail(r[COL.CLI.EMAIL]))     { mancanti.push('email');    dettaglio.push('📧 Email'); }
    if (!r[COL.CLI.EMAIL_SITI])           { mancanti.push('e.siti');   dettaglio.push('🌐 Email siti'); }
    if (!r[COL.CLI.OPERATORE])            { mancanti.push('oper.');    dettaglio.push('👤 Operatore'); }
    if (!r[COL.CLI.REFERRAL])             { mancanti.push('ref.');     dettaglio.push('🔗 Referral'); }
    if (!r[COL.CLI.TIPOLOGIA])            { mancanti.push('tipo');     dettaglio.push('🏷 Tipologia'); }
    if (r[COL.CLI.SPID] !== 'Sì')         { mancanti.push('spid');     dettaglio.push('🪪 SPID'); }
    if (r[COL.CLI.CC] !== 'Sì')           { mancanti.push('c/c');      dettaglio.push('🏦 Conto'); }
    if (!r[COL.CLI.DRIVE])               { mancanti.push('drive');    dettaglio.push('📁 Drive'); }
    if (hasV2 && r[COL.CLI.STATO_ACC] !== 'Accettato') {
      mancanti.push('acc.'); dettaglio.push('📜 Accettazione');
    }

    if (mancanti.length === 0) return;

    const prio = mancanti.length >= 6 ? 'ALTA' : mancanti.length >= 3 ? 'MEDIA' : 'BASSA';
    if (prio==='ALTA') alta++; else if (prio==='MEDIA') media++; else bassa++;

    const prossAzione = !r[COL.CLI.OPERATORE] ? '1️⃣ Assegna operatore'
      : !r[COL.CLI.STATO_ACC] || r[COL.CLI.STATO_ACC]==='In Attesa' ? '2️⃣ Fai accettare condizioni'
      : !normTel(r[COL.CLI.TEL]) ? '3️⃣ Chiedi telefono'
      : !r[COL.CLI.DRIVE] ? '4️⃣ Crea cartella Drive'
      : '5️⃣ Completa dati mancanti';

    righe.push({
      prio,
      data: [
        r[COL.CLI.ID], r[COL.CLI.NOME], r[COL.CLI.OPERATORE]||'—',
        r[COL.CLI.TEL]?'✅':'❌', r[COL.CLI.EMAIL]?'✅':'❌',
        r[COL.CLI.SPID]==='Sì'?'✅':'❌', r[COL.CLI.CC]==='Sì'?'✅':'❌',
        hasV2?(r[COL.CLI.STATO_ACC]==='Accettato'?'✅':'❌'):'?',
        r[COL.CLI.DRIVE]?'✅':'❌',
        mancanti.length,
        dettaglio.join(' • '),
        prossAzione,
        prio,
      ]
    });
  });

  righe.sort((a,b) => {
    const o={ALTA:0,MEDIA:1,BASSA:2};
    return (o[a.prio]||2)-(o[b.prio]||2);
  });

  if (righe.length > 0) {
    const vals = righe.map(r=>r.data);
    shDA.getRange(3, 1, vals.length, 13).setValues(vals).setWrap(true);
    righe.forEach((r, i) => {
      const row = 3 + i;
      const [bg,fg] = r.prio==='ALTA'?['#450a0a','#fca5a5']
        :r.prio==='MEDIA'?['#2d1c02','#fed7aa']:['#0a1a0a','#86efac'];
      shDA.getRange(row, 1, 1, 12).setBackground(bg).setFontColor('#e2e8f0');
      shDA.getRange(row, 13).setBackground(r.prio==='ALTA'?'#7f1d1d':r.prio==='MEDIA'?'#78350f':'#14532d')
        .setFontColor(fg).setFontWeight('bold').setHorizontalAlignment('center');
      shDA.setRowHeight(row, Math.max(32, (r.data[10]?.split('•').length||1)*18));
    });
  }

  // Aggiorna header status
  shDA.getRange('A1:M1').merge()
    .setValue(`🔧 DA COMPLETARE — ${new Date().toLocaleString('it-IT')} — Totale: ${righe.length} (🔴${alta} 🟡${media} 🟢${bassa})`);

  DB.ss().setActiveSheet(shDA);
  SpreadsheetApp.getUi().showToast(
    `Trovati ${righe.length} clienti incompleti (🔴${alta} urgenti)`, '🔧', 6);
}

function _briefingMattutino() {
  const ui  = SpreadsheetApp.getUi();
  const ora = new Date();
  const day = ora.toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long'});

  const cliData  = DB.read(SH.CLIENTI);
  const taskData = DB.read(SH.TASK);
  const penData  = DB.read(SH.PENALI);

  const attivi    = cliData.filter(r => r[COL.CLI.STATO]==='ATTIVO').length;
  const taskAlta  = taskData.filter(r => r[COL.TSK.PRIO]==='ALTA'   && r[COL.TSK.STATO]==='Aperto').length;
  const taskUrg   = taskData.filter(r => r[COL.TSK.PRIO]==='URGENTE'&& r[COL.TSK.STATO]==='Aperto').length;
  const scadOggi  = taskData.filter(r => {
    if (r[COL.TSK.STATO]!=='Aperto') return false;
    const s = r[COL.TSK.SCADENZA];
    return s instanceof Date && s.toDateString() === ora.toDateString();
  }).length;

  const penAttive = penData.filter(r => r[COL.PEN.STATO]==='In Calcolo').length;

  // Accettazioni in scadenza 48h
  const shC = DB.ss().getSheetByName(SH.CLIENTI);
  const hasV2 = shC && shC.getLastColumn() >= 26;
  const inScad48 = hasV2 ? cliData.filter(r => {
    if (r[COL.CLI.STATO_ACC] !== 'Accettato') return false;
    const d = r[COL.CLI.DATA_ACC];
    if (!(d instanceof Date)) return false;
    const ore = (new Date(d.getTime()+48*3600*1000) - ora) / (1000*60*60);
    return ore > 0 && ore <= 12;
  }) : [];

  let msg = `━━━  ${day.toUpperCase()}  ━━━\n\n`;
  msg += `👥  Clienti attivi: ${attivi}\n`;

  if (taskUrg > 0) msg += `\n🚨 URGENTE: ${taskUrg} task URGENTI da fare ADESSO!\n`;
  if (taskAlta > 0) msg += `🔴 ALTA: ${taskAlta} task ad alta priorità\n`;
  if (scadOggi > 0) msg += `⏰ Scadono OGGI: ${scadOggi} task\n`;
  if (penAttive > 0) msg += `⚠️ Penali attive: ${penAttive} — contatta i clienti!\n`;
  if (inScad48.length > 0) {
    msg += `\n⏰ IN SCADENZA 48H:\n`;
    inScad48.forEach(r => { msg += `  • ${r[COL.CLI.NOME]} (op: ${r[COL.CLI.OPERATORE]||'?'})\n`; });
  }

  if (taskUrg===0 && taskAlta===0 && penAttive===0 && scadOggi===0) {
    msg += '\n✅ Tutto ok! Puoi dedicarti all\'onboarding di nuovi clienti.\n';
  }

  msg += '\n💡 Menu → 📋 Genera Task per aggiornare la lista.';
  ui.alert('🌅  Buongiorno — Cosa Fare Oggi', msg, ui.ButtonSet.OK);
}

function _verificaSistema() {
  const ui = SpreadsheetApp.getUi();
  const checks = [];

  // Fogli
  const tuttiSH = [...Object.values(SH)];
  const mancanti = tuttiSH.filter(n => !DB.exists(n));
  checks.push(mancanti.length === 0
    ? `✅  ${tuttiSH.length} fogli presenti`
    : `❌  Fogli mancanti: ${mancanti.join(', ')}`);

  // Clienti
  const nCli = DB.count(SH.CLIENTI);
  const nBns = DB.count(SH.BONUS);
  checks.push(nCli > 0
    ? `✅  ${nCli} clienti | ${nBns} righe bonus`
    : `⚠️  Nessun cliente importato`);

  // Trigger
  const triggers = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  checks.push(triggers.includes('dailyAgent')
    ? '✅  Agente giornaliero attivo'
    : '⚠️  Agente giornaliero non installato');
  checks.push(triggers.includes('onFormSubmit')
    ? '✅  Trigger form installato'
    : '⚠️  Trigger form non installato');

  // Email config
  const email1 = DB.config('Email notifiche 1');
  checks.push(email1 ? `✅  Email report: ${email1}` : '⚠️  Email notifiche non configurata');

  // Header CLIENTI
  if (DB.exists(SH.CLIENTI)) {
    const issues = DB.validateHeaders(SH.CLIENTI, HDR.CLIENTI);
    checks.push(issues.length === 0
      ? '✅  Schema CLIENTI corretto'
      : `⚠️  Schema CLIENTI: ${issues.slice(0,2).join(', ')}`);
  }

  const nOk  = checks.filter(c=>c.startsWith('✅')).length;
  const nWrn = checks.filter(c=>c.startsWith('⚠️')).length;
  const nErr = checks.filter(c=>c.startsWith('❌')).length;

  ui.alert(
    `🔍  Verifica Sistema — ${nErr===0&&nWrn===0?'✅ TUTTO OK':nErr>0?'❌ PROBLEMI':' ⚠️ AVVISI'}`,
    checks.join('\n') + `\n\n────────────\n✅ ${nOk} ok  ⚠️ ${nWrn} avvisi  ❌ ${nErr} errori`,
    ui.ButtonSet.OK
  );
}
