// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 01_CONSTANTS.gs
//   Foundation Layer — Schema, Enums, Config
//   v3.0 — Architettura a Layer
// ═══════════════════════════════════════════════════════════════════════
//
//   REGOLA: questo file non contiene NESSUNA logica.
//   Solo definizioni. Ogni altro file dipende da questo.
//   Non modificare i COL.* senza aggiornare tutti i file.
// ═══════════════════════════════════════════════════════════════════════

// ── VERSIONE ─────────────────────────────────────────────────────────────

const MBBET_VERSION = '3.0.0';
const MBBET_BUILD   = '2026-07-01';

// ── NOMI FOGLI ────────────────────────────────────────────────────────────
//    Regola: dati grezzi → prefisso "_", UI → emoji
//    Mai rinominare i fogli manualmente senza aggiornare qui

const SH = {
  // Fogli UI
  HOME:        '🏠 HOME',
  RICERCA:     '🔍 RICERCA',
  DASH:        '📊 DASHBOARD',
  DASH_COLLAB: '📊 COLLAB',
  DASH_OPS:    '📊 OPERATORI',
  // Fogli dati
  CLIENTI:     '👥 CLIENTI',
  BONUS:       '💰 BONUS',
  COLLAB:      '🤝 COLLAB',
  PAGAMENTI:   '💸 PAGAMENTI',
  PENALI:      '⚠️ PENALI',
  TASK:        '✅ TASK',
  DOCUMENTI:   '📁 DOCUMENTI',
  // Fogli sistema
  LOG:         '📝 LOG',
  CFG:         '⚙️ CONFIG',
  BOOKMAKER:   '📋 BOOKMAKER',
  LISTE:       '_LISTE',
  // Fogli import/utility
  IMPORT:      '📥 IMPORT',
  DA_FARE:     '🔧 DA COMPLETARE',
};

// ── SCHEMA COLONNE ────────────────────────────────────────────────────────
//
//    COL.NOME_SHEET.NOME_COLONNA
//    Valore = indice 0-based per array access
//    Per getRange usare: COL.CLI.NOME + 1
//
//    ⚠️  Se cambi l'ordine di un header, aggiorna l'indice qui.
//       Tutti i file useranno automaticamente il nuovo indice.

const COL = {

  // ── CLIENTI ────────────────────────────────────────────────────
  CLI: {
    ID:              0,   // MBBET-001
    NOME:            1,   // Nome Cognome
    TEL:             2,   // 3331234567
    EMAIL:           3,   // email@example.com
    EMAIL_SITI:      4,   // email usata sui bookmaker
    OPERATORE:       5,   // chi segue il cliente
    REFERRAL:        6,   // chi ha portato
    TIPOLOGIA:       7,   // ORGANICO | REFERRAL | COLLABORAZIONE | VIP
    SPID:            8,   // Sì | No
    CC:              9,   // Sì | No (conto corrente)
    DATA_ING:        10,  // data primo ingresso
    STATO:           11,  // ATTIVO | IN PAUSA | COMPLETATO | INATTIVO | BANNATO
    DRIVE:           12,  // link cartella Drive
    TOT_RICAVO:      13,  // formula: SUMIF su BONUS!RIC_REAL
    TOT_PAGATO:      14,  // formula: SUMIF su BONUS!PAG_CLI
    MARGINE:         15,  // formula: TOT_RICAVO - TOT_PAGATO - (etc.)
    COSTO_REF:       16,  // costo referral tier
    POT_RESIDUO:     17,  // potenziale ancora non realizzato
    PROSS_BONUS:     18,  // prossimo bookmaker suggerito
    PRIORITA:        19,  // URGENTE | ALTA | MEDIA | BASSA
    MESE:            20,  // mese ingresso
    NUOVO_VEC:       21,  // Nuovo | Già Cliente
    NOTE:            22,  // note libere
    COLLAB:          23,  // nome collab di provenienza
    DATA_ACC:        24,  // data accettazione condizioni
    STATO_ACC:       25,  // Accettato | In Attesa | Non Accettato
    PENALE_ATT:      26,  // Sì | No
    GG_RITARDO:      27,  // formula: giorni ritardo prima op
    TOT_PENALE:      28,  // formula: GG_RITARDO * €10
    DATA_PRIMA_OP:   29,  // quando ha iniziato la prima op
    _N:              30,  // numero totale colonne (non è un campo)
  },

  // ── BONUS ──────────────────────────────────────────────────────
  BNS: {
    ID:              0,   // BNS-0001
    ID_CLI:          1,   // MBBET-001
    CLIENTE:         2,   // nome (denormalizzato per leggibilità)
    BK:              3,   // bookmaker
    TIER:            4,   // S+ | S | A | B | C | Standby
    STATO:           5,   // LIBERO | IN CORSO | FATTO | ...
    OPERATORE:       6,   // chi segue questo bonus
    PERC_OP:         7,   // % commissione operatore
    REFERRAL:        8,   // referral associato
    RIC_PREV:        9,   // ricavo previsto
    RIC_REAL:        10,  // ricavo reale
    PAG_CLI:         11,  // quanto pagato al cliente
    COMP_OP:         12,  // formula: RIC_REAL * PERC_OP / 100
    COSTI_EX:        13,  // costi extra (manuale)
    MARGINE:         14,  // formula: RIC_REAL - PAG_CLI - COMP_OP - COSTI_EX - COMP_COLLAB
    DATA_AP:         15,  // data apertura
    ULT_AZ:          16,  // ultima azione
    PROSS_AZ:        17,  // prossima azione (testo libero)
    PRIORITA:        18,  // URGENTE | ALTA | MEDIA | BASSA
    NOTE:            19,  // note
    ID_COLLAB:       20,  // CLB-001
    NOME_COLLAB:     21,  // nome collab (denormalizzato)
    COMP_COLLAB:     22,  // compenso collab per questo bonus
    _N:              23,
  },

  // ── COLLAB ─────────────────────────────────────────────────────
  CLB: {
    ID:              0,   // CLB-001
    NOME:            1,
    CONTATTO:        2,   // tel o email
    TIPO:            3,   // Individuale | Azienda | Community | Influencer
    OP_RIF:          4,   // operatore MBBET di riferimento
    CLI_PORTATI:     5,   // formula: COUNTIF su CLIENTI!COLLAB
    BNS_COLLEGATI:   6,   // formula: COUNTIF su BONUS!NOME_COLLAB
    PERC:            7,   // % compenso
    TOT_RIC:         8,   // formula: SUMIF su BONUS!RIC_REAL per questa collab
    TOT_COMP:        9,   // formula: TOT_RIC * PERC / 100
    SALDO:           10,  // formula: TOT_COMP - tot pagato
    STATO:           11,  // Attiva | In Pausa | Conclusa | Sospesa
    DATA_INI:        12,
    ULT_ATT:         13,
    NOTE:            14,
    _N:              15,
  },

  // ── PAGAMENTI ──────────────────────────────────────────────────
  PAG: {
    ID:              0,   // PAG-0001
    DATA:            1,
    ID_CLI:          2,
    NOME_CLI:        3,
    TIPO:            4,   // Cliente | Operatore | Referral | Collab | Altro
    BENEFICIARIO:    5,
    IMPORTO:         6,
    METODO:          7,   // Bonifico | PayPal | Satispay | Contanti | Altro
    CAUSALE:         8,
    STATO:           9,   // Da Pagare | Pagato | Parziale | Annullato
    NOTE:            10,
    _N:              11,
  },

  // ── PENALI ─────────────────────────────────────────────────────
  PEN: {
    ID:              0,   // PEN-0001
    ID_CLI:          1,
    NOME_CLI:        2,
    DATA_ACC:        3,
    SCAD_48H:        4,
    DATA_PRIMA_OP:   5,
    ORE_RIT:         6,
    GG_RIT:          7,
    EUR_GG:          8,   // fisso: 10
    TOT_MAT:         9,   // GG_RIT * EUR_GG
    TOT_PAG:         10,  // quanto già pagato
    SALDO:           11,  // TOT_MAT - TOT_PAG
    STATO:           12,  // Nessuna | In Calcolo | Da Riscuotere | Pagata | Annullata
    NOTE:            13,
    _N:              14,
  },

  // ── TASK ───────────────────────────────────────────────────────
  TSK: {
    ID:              0,   // TSK-00001
    PRIO:            1,   // URGENTE | ALTA | MEDIA | BASSA
    TIPO:            2,   // PRIMA OPERAZIONE | CLIENTE FERMO | PENALE | ecc.
    ID_CLI:          3,
    NOME_CLI:        4,
    OPERATORE:       5,
    DESC:            6,
    SCADENZA:        7,
    STATO:           8,   // Aperto | In Corso | Fatto | Annullato
    DATA_CR:         9,
    NOTE:            10,
    _N:              11,
  },

  // ── DOCUMENTI ──────────────────────────────────────────────────
  DOC: {
    ID:              0,   // DOC-00001
    ID_CLI:          1,
    NOME_CLI:        2,
    TIPO:            3,
    LINK:            4,
    DATA_UP:         5,
    STATO:           6,   // Presente | Mancante | Da Verificare | Scaduto
    NOTE:            7,
    _N:              8,
  },

  // ── LOG ────────────────────────────────────────────────────────
  LOG: {
    TS:              0,
    TIPO:            1,
    ID:              2,
    NOME:            3,
    DET:             4,
    ESITO:           5,
    ERR:             6,
    _N:              7,
  },
};

// ── HEADERS TABELLE ───────────────────────────────────────────────────────
//    Ordine deve corrispondere agli indici in COL.*

const HDR = {
  CLIENTI: [
    'ID Cliente','Nome Cliente','Telefono','Email Cliente','Email Siti',
    'Operatore','Referral','Tipologia','Ha SPID','Conto Corrente',
    'Data Ingresso','Stato','Link Drive',
    'Totale Ricavo €','Totale Pagato €','Margine Totale €',
    'Costo Referral €','Potenziale Residuo €','Prossimo Bonus',
    'Priorità','Mese Ingresso','Nuovo/Già Cliente','Note',
    'Collab','Data Accettazione','Stato Accettazione',
    'Penale Attiva','Giorni Ritardo','Totale Penale €','Data Prima Op.',
  ],
  BONUS: [
    'ID Bonus','ID Cliente','Cliente','Bookmaker','Tier',
    'Stato','Operatore','% Op.','Referral',
    'Ricavo Previsto €','Ricavo Reale €','Pagato Cliente €',
    'Comp. Operatore €','Costi Extra €','Margine €',
    'Data Apertura','Ultima Azione','Prossima Azione','Priorità','Note',
    'ID Collab','Nome Collab','Compenso Collab €',
  ],
  COLLAB: [
    'ID Collab','Nome Collab','Contatto','Tipo','Operatore Rif.',
    'Clienti Portati','Bonus Collegati',
    '% Compenso','Totale Ricavo €','Totale Compenso €','Saldo da Pagare €',
    'Stato','Data Inizio','Ultima Attività','Note',
  ],
  PAGAMENTI: [
    'ID Pagamento','Data','ID Cliente','Nome Cliente',
    'Tipo','Beneficiario','Importo €','Metodo','Causale','Stato','Note',
  ],
  PENALI: [
    'ID Penale','ID Cliente','Nome Cliente',
    'Data Accettazione','Scadenza 48h','Data Prima Op.',
    'Ore Ritardo','Giorni Ritardo','€/Giorno',
    'Totale Maturata €','Totale Pagata €','Saldo €',
    'Stato Penale','Note',
  ],
  TASK: [
    'ID Task','Priorità','Tipo','ID Cliente','Nome Cliente',
    'Operatore','Descrizione','Scadenza','Stato','Data Creazione','Note',
  ],
  DOCUMENTI: [
    'ID Doc','ID Cliente','Nome Cliente','Tipo Documento',
    'Link','Data Upload','Stato','Note',
  ],
  LOG: [
    'Timestamp','Tipo','ID Ref.','Nome','Dettaglio','Esito','Errore',
  ],
  BOOKMAKER: [
    'Bookmaker','Tier','Attivo','Priorità',
    'Ricavo Min €','Ricavo Max €','Note',
  ],
};

// ── VALORI ENUM ────────────────────────────────────────────────────────────

const STATI_BK = [
  'LIBERO', 'IN CORSO', 'FATTO',
  'LIMITATO', 'BANNATO', 'GIÀ REGISTRATO', 'NON IDONEO',
  'IN ATTESA CLIENTE', 'DA VERIFICARE',
];

const STATI_CLI = ['ATTIVO', 'IN PAUSA', 'COMPLETATO', 'INATTIVO', 'BANNATO'];
const TIPOLOGIE  = ['ORGANICO', 'REFERRAL', 'COLLABORAZIONE', 'VIP'];
const PRIORITA   = ['URGENTE', 'ALTA', 'MEDIA', 'BASSA'];

const STATI_ACC     = ['Accettato', 'In Attesa', 'Non Accettato'];
const STATI_PAG     = ['Da Pagare', 'Pagato', 'Parziale', 'Annullato'];
const STATI_PENALE  = ['Nessuna', 'In Calcolo', 'Da Riscuotere', 'Pagata', 'Annullata'];
const STATI_TASK    = ['Aperto', 'In Corso', 'Fatto', 'Annullato'];
const STATI_COLLAB  = ['Attiva', 'In Pausa', 'Conclusa', 'Sospesa'];
const TIPI_COLLAB   = ['Individuale', 'Azienda', 'Community', 'Influencer'];
const METODI_PAG    = ['Bonifico', 'PayPal', 'Satispay', 'Contanti', 'Altro'];
const TIPI_DOC      = ['CI Fronte','CI Retro','TS Fronte','TS Retro','Selfie','Contratto','IBAN','Altro'];
const STATI_DOC     = ['Presente', 'Mancante', 'Da Verificare', 'Scaduto'];
const TIPI_PAG      = ['Cliente', 'Operatore', 'Referral', 'Collab', 'Penale', 'Altro'];
const TIPI_TASK     = [
  'PRIMA OPERAZIONE', 'CLIENTE FERMO', 'PENALE ATTIVA',
  'AVVIA PROSSIMO BONUS', 'IMPOSTA PROSSIMA AZIONE',
  'CLIENTE NON HA INIZIATO', 'FOLLOW-UP', 'ALTRO',
];

// ── LISTA BOOKMAKER ────────────────────────────────────────────────────────

const BOOKMAKERS = [
  {nome:'BETFLAG',         tier:'S+', attivo:true,  rMin:100, rMax:150, prio:1},
  {nome:'GIOCO DIGITALE',  tier:'S+', attivo:true,  rMin:120, rMax:150, prio:2},
  {nome:'BET365',          tier:'S',  attivo:true,  rMin:250, rMax:450, prio:3},
  {nome:'SISAL',           tier:'S',  attivo:true,  rMin:100, rMax:150, prio:4},
  {nome:'SNAI',            tier:'S',  attivo:true,  rMin:80,  rMax:130, prio:5},
  {nome:'EUROBET',         tier:'A',  attivo:true,  rMin:60,  rMax:100, prio:6},
  {nome:'GOLDBET',         tier:'A',  attivo:true,  rMin:60,  rMax:100, prio:7},
  {nome:'BETWAY',          tier:'A',  attivo:true,  rMin:50,  rMax:80,  prio:8},
  {nome:'VINCITU',         tier:'A',  attivo:true,  rMin:50,  rMax:80,  prio:9},
  {nome:'ADMIRALBET',      tier:'A',  attivo:true,  rMin:50,  rMax:80,  prio:10},
  {nome:'SPORTBET',        tier:'B',  attivo:true,  rMin:30,  rMax:60,  prio:11},
  {nome:'BWIN',            tier:'B',  attivo:true,  rMin:30,  rMax:60,  prio:12},
  {nome:'WILLIAM HILL',    tier:'B',  attivo:true,  rMin:30,  rMax:50,  prio:13},
  {nome:'NETBET',          tier:'B',  attivo:true,  rMin:30,  rMax:50,  prio:14},
  {nome:'UNIBET',          tier:'B',  attivo:true,  rMin:30,  rMax:50,  prio:15},
  {nome:'BETSSON',         tier:'B',  attivo:true,  rMin:25,  rMax:45,  prio:16},
  {nome:'LEOVEGAS',        tier:'B',  attivo:true,  rMin:25,  rMax:45,  prio:17},
  {nome:'BETCLIC',         tier:'C',  attivo:true,  rMin:20,  rMax:35,  prio:18},
  {nome:'888SPORT',        tier:'C',  attivo:true,  rMin:20,  rMax:35,  prio:19},
  {nome:'MYLOTTERY',       tier:'Standby', attivo:false, rMin:0,  rMax:0,  prio:20},
  {nome:'LOTTOMATICA',     tier:'Standby', attivo:false, rMin:0,  rMax:0,  prio:21},
  {nome:'PLANETWIN365',    tier:'Standby', attivo:false, rMin:30, rMax:40, prio:22},
];

// Alias per normalizzazione nomi bookmaker
const BK_ALIAS = {
  'VINCITÙ':       'VINCITU',
  'VINCIT':        'VINCITU',
  'PLANETWIN':     'PLANETWIN365',
  'SPORT BET':     'SPORTBET',
  'ADMIRAL':       'ADMIRALBET',
  'GOLDBET IT':    'GOLDBET',
  'GD':            'GIOCO DIGITALE',
  'GIO. DIG.':     'GIOCO DIGITALE',
  'GIOCO DIG':     'GIOCO DIGITALE',
  'W HILL':        'WILLIAM HILL',
  'WILL HILL':     'WILLIAM HILL',
  '888':           '888SPORT',
  'BETCL':         'BETCLIC',
};

// ── TIER REFERRAL ─────────────────────────────────────────────────────────

const REFERRAL_TIERS = [
  {nome:'Bronze',  min:1,  max:3,  euro:10},
  {nome:'Silver',  min:4,  max:9,  euro:15},
  {nome:'Gold',    min:10, max:19, euro:20},
  {nome:'Diamond', min:20, max:49, euro:25},
  {nome:'Elite',   min:50, max:999, euro:30},
];

// ── ID PREFIX ─────────────────────────────────────────────────────────────

const PFX = {
  CLI: 'MBBET-',
  BNS: 'BNS-',
  CLB: 'CLB-',
  PAG: 'PAG-',
  PEN: 'PEN-',
  TSK: 'TSK-',
  DOC: 'DOC-',
};

// ── CONFIGURAZIONE SISTEMA ────────────────────────────────────────────────

const CFG = {
  PENALE_GG:    10,          // € per giorno ritardo
  ORE_PRIMA_OP: 48,          // ore per avviare dopo accettazione
  GG_FERMO:     7,           // giorni inattività prima alert
  GG_FERMO_URG: 14,          // giorni per task URGENTE
  BATCH_SIZE:   500,         // righe per operazione batch
  MAX_LOG:      2000,        // max righe LOG (poi taglia)
  DRIVE_ROOT:   'CRM MBBET - Documenti Clienti',
  TIMEZONE:     'Europe/Rome',
  AGENTE_ORA:   8,           // ora agente giornaliero (08:00)
};

// ── COLORI HOUSE STYLE ────────────────────────────────────────────────────

const C = {
  // Fondamentali
  NAVY:      '#0a0e1a',
  NAVY2:     '#111827',
  NAVY3:     '#1e2a3a',
  NAVY4:     '#0d1520',
  GOLD:      '#f5c842',
  GOLD2:     '#ffd700',
  GOLD3:     '#e8b800',
  WHITE:     '#ffffff',
  // Status: green
  GREEN:     '#22c55e',
  GREEN_BG:  '#dcfce7',
  GREEN_T:   '#166534',
  // Status: yellow
  YELLOW:    '#eab308',
  YELLOW_BG: '#fefce8',
  YELLOW_T:  '#713f12',
  // Status: blue
  BLUE:      '#3b82f6',
  BLUE_BG:   '#dbeafe',
  BLUE_T:    '#1e3a8a',
  // Status: purple
  PURPLE:    '#8b5cf6',
  PURPLE_BG: '#ede9fe',
  PURPLE_T:  '#4c1d95',
  // Status: red
  RED:       '#ef4444',
  RED_BG:    '#fee2e2',
  RED_T:     '#7f1d1d',
  // Status: orange
  ORANGE:    '#f97316',
  ORANGE_BG: '#fff7ed',
  ORANGE_T:  '#7c2d12',
  // Status: teal
  TEAL:      '#14b8a6',
  TEAL_BG:   '#ccfbf1',
  TEAL_T:    '#134e4a',
  // Neutrals
  STEEL:     '#94a3b8',
  GRAY:      '#e2e8f0',
  DGRAY:     '#64748b',
  DARK:      '#1e293b',
};

// Mappa status → stile visivo
const STATUS_STYLE = {
  // Bookmaker
  'LIBERO':            {bg: C.GREEN_BG,  fg: C.GREEN_T,  bold: true},
  'IN CORSO':          {bg: C.YELLOW_BG, fg: C.YELLOW_T, bold: true},
  'FATTO':             {bg: C.BLUE_BG,   fg: C.BLUE_T,   bold: true},
  'LIMITATO':          {bg: C.PURPLE_BG, fg: C.PURPLE_T, bold: true},
  'BANNATO':           {bg: C.RED_BG,    fg: C.RED_T,    bold: true},
  'GIÀ REGISTRATO':    {bg: '#f1f5f9',   fg: '#475569',  bold: false},
  'NON IDONEO':        {bg: C.NAVY3,     fg: C.STEEL,    bold: false},
  'IN ATTESA CLIENTE': {bg: C.ORANGE_BG, fg: C.ORANGE_T, bold: true},
  'DA VERIFICARE':     {bg: '#fef3c7',   fg: '#92400e',  bold: true},
  // Clienti
  'ATTIVO':     {bg: C.GREEN_BG,  fg: C.GREEN_T,  bold: true},
  'IN PAUSA':   {bg: C.YELLOW_BG, fg: C.YELLOW_T, bold: false},
  'COMPLETATO': {bg: C.BLUE_BG,   fg: C.BLUE_T,   bold: false},
  'INATTIVO':   {bg: '#f1f5f9',   fg: '#475569',  bold: false},
  // Priorità
  'URGENTE': {bg: '#450a0a', fg: '#fca5a5', bold: true},
  'ALTA':    {bg: C.RED_BG,  fg: C.RED_T,  bold: true},
  'MEDIA':   {bg: C.YELLOW_BG, fg: C.YELLOW_T, bold: false},
  'BASSA':   {bg: C.GREEN_BG, fg: C.GREEN_T,  bold: false},
};

// Colori tier bookmaker
const TIER_STYLE = {
  'S+':      {bg: '#fef9c3', fg: '#713f12', bold: true},
  'S':       {bg: '#f0fdf4', fg: '#166534', bold: true},
  'A':       {bg: '#eff6ff', fg: '#1e3a8a', bold: false},
  'B':       {bg: '#faf5ff', fg: '#4c1d95', bold: false},
  'C':       {bg: '#f8fafc', fg: '#475569', bold: false},
  'Standby': {bg: '#1e293b', fg: '#64748b', bold: false},
};

// ── MAPPING VECCHIO FORM ──────────────────────────────────────────────────
//    Colonne 1-based del vecchio Google Form (Risposte foglio)

const OF = {
  TIMESTAMP:       1,
  NOME:            2,
  EMAIL:           3,
  EMAIL_SITI:      4,
  TELEFONO:        5,
  DI_CHI:          6,
  REFERRAL:        7,
  NUOVO_VECCHIO:   8,
  INSTAGRAM:       9,
  CI_FRONTE:       10,
  CI_RETRO:        11,
  TS_FRONTE:       12,
  TS_RETRO:        13,
  FOTO_FRONTE:     14,
  FOTO_RETRO:      15,
  AUT_DOCS:        16,
  SPID:            17,
  SITI_REGISTRATI: 18,
  CONTO_CORRENTE:  19,
  MARKETING:       20,
  CONTRATTO:       21,
  RIEPILOGO:       22,
  OPERATORE:       23,
  TIPOLOGIA:       24,
  MESE:            25,
};

// ── UTILITY FUNCTIONS ─────────────────────────────────────────────────────
//    Piccole helper pure, senza side effects, senza accesso al foglio

function mkId(prefisso, numero, padding) {
  return prefisso + String(numero).padStart(padding || 4, '0');
}

function fmtDate(d) {
  if (!d) return '';
  try {
    const dt = d instanceof Date ? d : new Date(d);
    return dt.toLocaleDateString('it-IT', {day:'2-digit', month:'2-digit', year:'numeric'});
  } catch (_) { return String(d); }
}

function fmtDateTime(d) {
  if (!d) return '';
  try {
    const dt = d instanceof Date ? d : new Date(d);
    return dt.toLocaleString('it-IT');
  } catch (_) { return String(d); }
}

function fmtEuro(n) {
  const val = parseFloat(n) || 0;
  return '€ ' + val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function normNome(v) {
  return (v || '').toString().trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function normEmail(v) {
  return (v || '').toString().trim().toLowerCase();
}

function normTel(v) {
  return (v || '').toString()
    .replace(/[\s\-\.\(\)]/g, '')
    .replace(/^(\+39|0039)/, '');
}

function normSpid(v) {
  const s = (v || '').toString().toLowerCase();
  return (s.includes('sì') || s.includes('si') || s.includes('attivo') || s.includes('yes')) ? 'Sì' : 'No';
}

function normBK(v) {
  if (!v) return '';
  const u = v.toString().trim().toUpperCase();
  return BK_ALIAS[u] || u;
}

function calcRefTier(completati) {
  const n = parseInt(completati) || 0;
  for (const t of REFERRAL_TIERS) {
    if (n >= t.min && n <= t.max) return t.euro;
  }
  return 10;
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
}

function isValidPhone(t) {
  const n = normTel(t);
  return /^[0-9]{9,11}$/.test(n);
}
