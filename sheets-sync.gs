// ═══════════════════════════════════════════════════════════
//  K-Shop ↔ Google Sheets Sync
//  הדבק את הקוד הזה ב-Apps Script ושמור (Ctrl+S)
// ═══════════════════════════════════════════════════════════

// ── הגדרות ────────────────────────────────────────────────
const SHEET_NAME  = 'מתנפחים מעודכן';
const COL_SKU     = 1;  // עמודה A — מק"ט
const COL_NAME    = 2;  // עמודה B — סוג המתנפח
const COL_QTY_OLD = 5;  // עמודה E — כמות באלישמע ישן
const COL_QTY_NEW = 7;  // עמודה G — כמות באלישמע חדש

const SERVER_URL  = 'https://landmine-thumb-stegosaur.ngrok-free.dev';
const KSHOP_TOKEN = '43c1745030c25ec9ba6ba2099acdd600a188bb7eae8facea';

// ═══════════════════════════════════════════════════════════
//  onEdit — מזהה שינוי ב-Sheets ושולח לשרת
// ═══════════════════════════════════════════════════════════
function onEdit(e) {
  // אם KShop כותב כרגע — אל תיצור לולאה
  if (CacheService.getScriptCache().get('KSHOP_WRITING')) return;

  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row <= 1) return; // שורת כותרות
  if (col !== COL_QTY_OLD && col !== COL_QTY_NEW) return;

  const sku = sheet.getRange(row, COL_SKU).getValue();
  if (!sku) return;

  const qtyOld = Number(sheet.getRange(row, COL_QTY_OLD).getValue()) || 0;
  const qtyNew = Number(sheet.getRange(row, COL_QTY_NEW).getValue()) || 0;

  const ok = sendToServer('/sheets-sync', {
    sku:       String(sku),
    qty_old:   qtyOld,
    qty_new:   qtyNew,
    source:    'sheets',
    timestamp: new Date().toISOString()
  });

  if (!ok) {
    queueChange(sku, qtyOld, qtyNew);
    Logger.log('Server unreachable — queued: ' + sku);
  }
}

// ═══════════════════════════════════════════════════════════
//  doPost — מקבל עדכונים מ-KShop (Web App endpoint)
// ═══════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.token !== KSHOP_TOKEN) {
      return jsonResponse({ error: 'Unauthorized' });
    }

    // נעל כתיבה כדי שonEdit לא יחזיר הד
    const cache = CacheService.getScriptCache();
    cache.put('KSHOP_WRITING', '1', 30);

    try {
      switch (data.action) {
        case 'update':        updateRow(data.sku, data.name, data.qty_old, data.qty_new); break;
        case 'create':        createRow(data.sku, data.name, data.qty_old, data.qty_new); break;
        case 'get_all':       return getAllRows();
        case 'process_queue': processQueue(); break;
        case 'batch_update':  batchUpdate(data.items || []); break;
      }
    } finally {
      cache.remove('KSHOP_WRITING');
    }

    return jsonResponse({ success: true });
  } catch(err) {
    Logger.log('doPost error: ' + err.toString());
    return jsonResponse({ error: err.toString() });
  }
}

// ═══════════════════════════════════════════════════════════
//  עדכון / יצירת שורה
// ═══════════════════════════════════════════════════════════
function updateRow(sku, name, qtyOld, qtyNew) {
  const sheet = getMainSheet();
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL_SKU - 1]) === String(sku)) {
      sheet.getRange(i + 1, COL_QTY_OLD).setValue(qtyOld || 0);
      sheet.getRange(i + 1, COL_QTY_NEW).setValue(qtyNew || 0);
      return;
    }
  }
  // לא נמצא — צור שורה חדשה
  createRow(sku, name, qtyOld, qtyNew);
}

function createRow(sku, name, qtyOld, qtyNew) {
  const sheet  = getMainSheet();
  const newRow = new Array(Math.max(sheet.getLastColumn(), COL_QTY_NEW)).fill('');
  newRow[COL_SKU  - 1] = String(sku);
  newRow[COL_NAME - 1] = name || '';
  newRow[COL_QTY_OLD - 1] = qtyOld || 0;
  newRow[COL_QTY_NEW - 1] = qtyNew || 0;
  sheet.appendRow(newRow);
}

// ═══════════════════════════════════════════════════════════
//  החזר את כל השורות (לסנכרון ראשוני)
// ═══════════════════════════════════════════════════════════
function getAllRows() {
  const sheet = getMainSheet();
  const data  = sheet.getDataRange().getValues();
  const rows  = [];

  for (let i = 1; i < data.length; i++) {
    const sku  = data[i][COL_SKU  - 1];
    const name = data[i][COL_NAME - 1];
    if (!sku && !name) continue;
    rows.push({
      sku:     String(sku  || '').trim(),
      name:    String(name || '').trim(),
      qty_old: Number(data[i][COL_QTY_OLD - 1]) || 0,
      qty_new: Number(data[i][COL_QTY_NEW - 1]) || 0
    });
  }

  return jsonResponse({ rows });
}

// ═══════════════════════════════════════════════════════════
//  עדכון מרובה — קריאה אחת לגיליון במקום N קריאות
// ═══════════════════════════════════════════════════════════
function batchUpdate(items) {
  if (!items || items.length === 0) return;
  const sheet = getMainSheet();
  const data  = sheet.getDataRange().getValues();

  // בנה מפה SKU → item לחיפוש מהיר
  const skuMap = {};
  items.forEach(item => { skuMap[String(item.sku)] = item; });

  // עדכן שורות קיימות
  for (let i = 1; i < data.length; i++) {
    const sku = String(data[i][COL_SKU - 1]).trim();
    if (!sku || !skuMap[sku]) continue;
    sheet.getRange(i + 1, COL_QTY_OLD).setValue(skuMap[sku].qty_old || 0);
    sheet.getRange(i + 1, COL_QTY_NEW).setValue(skuMap[sku].qty_new || 0);
    delete skuMap[sku];
  }

  // צור שורות למק"טים שלא נמצאו
  Object.values(skuMap).forEach(item => {
    createRow(item.sku, item.name, item.qty_old, item.qty_new);
  });
}

// ═══════════════════════════════════════════════════════════
//  Queue — שינויים שהצטברו כשהשרת היה כבוי
// ═══════════════════════════════════════════════════════════
function queueChange(sku, qtyOld, qtyNew) {
  getQueueSheet().appendRow([
    new Date().toISOString(), String(sku), qtyOld, qtyNew, 'pending'
  ]);
}

function processQueue() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const q  = ss.getSheetByName('_Queue');
  if (!q) return;

  const rows = q.getDataRange().getValues();
  let processed = 0;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][4] !== 'pending') continue;

    const ok = sendToServer('/sheets-sync', {
      sku:       String(rows[i][1]),
      qty_old:   Number(rows[i][2]),
      qty_new:   Number(rows[i][3]),
      source:    'sheets',
      timestamp: rows[i][0]
    });

    if (ok) {
      q.getRange(i + 1, 5).setValue('done');
      processed++;
    }
  }

  Logger.log('Queue processed: ' + processed + ' items');
}

// ═══════════════════════════════════════════════════════════
//  Trigger — הרץ פעם אחת ידנית כדי להגדיר
// ═══════════════════════════════════════════════════════════
function setupTriggers() {
  // מחק triggers קיימים
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  // הוסף trigger כל 10 דקות לprocessQueue
  ScriptApp.newTrigger('processQueue').timeBased().everyMinutes(10).create();
  Logger.log('Triggers set up successfully');
}

// ═══════════════════════════════════════════════════════════
//  עזרים
// ═══════════════════════════════════════════════════════════
function getMainSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function getQueueSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let q = ss.getSheetByName('_Queue');
  if (!q) {
    q = ss.insertSheet('_Queue');
    q.getRange('A1:E1').setValues([['timestamp','sku','qty_old','qty_new','status']]);
    q.hideSheet();
  }
  return q;
}

function sendToServer(path, body) {
  try {
    const resp = UrlFetchApp.fetch(SERVER_URL + path, {
      method:            'POST',
      headers: {
        'Content-Type':             'application/json',
        'x-kshop-token':            KSHOP_TOKEN,
        'ngrok-skip-browser-warning': 'true'
      },
      payload:           JSON.stringify(body),
      muteHttpExceptions: true
    });
    return resp.getResponseCode() === 200;
  } catch(e) {
    Logger.log('sendToServer error: ' + e.toString());
    return false;
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
