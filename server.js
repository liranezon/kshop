/**
 * K-Shop – WhatsApp Automation Server
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');
const express  = require('express');
const cors     = require('cors');
const qrcode   = require('qrcode-terminal');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

// ── API Token ──────────────────────────────────────────────
const TOKEN_FILE = path.join(__dirname, 'api-token.txt');
let API_TOKEN;
if (fs.existsSync(TOKEN_FILE)) {
  API_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
} else {
  API_TOKEN = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(TOKEN_FILE, API_TOKEN);
}

// ── Supabase Admin ─────────────────────────────────────────
const SUPABASE_URL      = 'https://vtrzxykuhacrlqzgdbfe.supabase.co';
const SUPA_KEY_FILE     = path.join(__dirname, 'supabase-service-key.txt');
const APPS_SCRIPT_FILE  = path.join(__dirname, 'apps-script-url.txt');
const WH_OLD = 'alishma_old';
const WH_NEW = 'alishma_new';

let supabaseAdmin = null;
let APPS_SCRIPT_URL = '';

try {
  const key = fs.readFileSync(SUPA_KEY_FILE, 'utf8').trim();
  supabaseAdmin = createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  console.log('✅ Supabase admin client מוכן');
} catch {
  console.warn('⚠️  supabase-service-key.txt לא נמצא — sync מושבת');
}

try {
  APPS_SCRIPT_URL = fs.readFileSync(APPS_SCRIPT_FILE, 'utf8').trim();
  console.log('✅ Apps Script URL טעון');
} catch {
  console.warn('⚠️  apps-script-url.txt לא נמצא');
}

// ── Sync State ─────────────────────────────────────────────
const syncLog  = [];
const syncLock = new Set(); // SKUs שנשלחו מהשרת כדי למנוע echo

function addLog(msg) {
  const entry = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' ' + msg;
  syncLog.push(entry);
  if (syncLog.length > 100) syncLog.shift();
  console.log('[sync]', msg);
}

async function pushToSheets(action, data, customUrl) {
  const url = customUrl || APPS_SCRIPT_URL;
  if (!url) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...data, action, token: API_TOKEN }),
      signal:  controller.signal,
    });
    return resp.ok;
  } catch(e) {
    addLog('pushToSheets ' + (e.name === 'AbortError' ? 'timeout' : e.message));
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ── Express + CORS ─────────────────────────────────────────
const app = express();

// CORS פתוח לכל דומיין — האבטחה היא ה-Token
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '150mb' }));
app.use(express.static(path.join(__dirname, '..')));

// ── Token Middleware ───────────────────────────────────────
function requireToken(req, res, next) {
  const token = req.headers['x-kshop-token'];
  if (!token || token !== API_TOKEN) {
    console.warn('Unauthorized from:', req.ip);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Chrome ────────────────────────────────────────────────
function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) { console.log('Chrome: ' + p); return p; } }
    catch(e) {}
  }
  return null;
}
const chromePath = findChrome();

// ── WhatsApp ───────────────────────────────────────────────
let waStatus = 'initializing';
let latestQR = null;

const puppeteerArgs = [
  '--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
  '--disable-gpu','--no-first-run','--disable-extensions',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-site-isolation-trials',
];
const puppeteerConfig = { headless: true, args: puppeteerArgs };
if (chromePath) puppeteerConfig.executablePath = chromePath;

const SESSION_PATH = path.join(__dirname, 'ww-session');
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
  puppeteer: puppeteerConfig,
});

client.on('qr', (qr) => {
  waStatus = 'qr'; latestQR = qr;
  console.log('\n' + '='.repeat(50));
  console.log('סרוק QR עם וואטסאפ');
  console.log('='.repeat(50) + '\n');
  qrcode.generate(qr, { small: true });
});
client.on('loading_screen', () => { waStatus = 'connecting'; });
client.on('ready', () => {
  waStatus = 'ready'; latestQR = null;
  console.log('\n=== וואטסאפ מחובר! ===\n');
});
client.on('auth_failure', () => { waStatus = 'error'; });
client.on('disconnected', (reason) => {
  waStatus = 'initializing'; latestQR = null;
  if (reason === 'LOGOUT') {
    try { fs.rmSync(SESSION_PATH, { recursive: true, force: true }); } catch(e) {}
  }
  setTimeout(() => client.initialize().catch(console.error), 3000);
});
client.initialize().catch(e => { waStatus = 'error'; console.error(e.message); });

// ── Utils ──────────────────────────────────────────────────
function formatPhone(phone) {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('972')) return d + '@c.us';
  if (d.startsWith('0'))   return '972' + d.slice(1) + '@c.us';
  return '972' + d + '@c.us';
}
const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Routes ─────────────────────────────────────────────────
app.get('/status', (req, res) => res.json({ status: waStatus }));

app.get('/qr', requireToken, (req, res) => {
  if (waStatus !== 'qr' || !latestQR)
    return res.status(404).json({ error: 'אין QR זמין', status: waStatus });
  res.json({ qr: latestQR });
});

app.get('/contacts', requireToken, async (req, res) => {
  if (waStatus !== 'ready')
    return res.status(503).json({ error: 'וואטסאפ לא מחובר', status: waStatus });
  try {
    const contacts = await client.getContacts();
    const list = contacts
      .filter(c => c.isUser && !c.isGroup && (c.name || c.pushname) && c.number)
      .map(c => ({ id: c.number+'@c.us', name: c.name||c.pushname, phone: c.number }))
      .sort((a,b) => a.name.localeCompare(b.name,'he'));
    res.json({ contacts: list, total: list.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/send', requireToken, async (req, res) => {
  if (waStatus !== 'ready')
    return res.status(503).json({ error: 'וואטסאפ לא מחובר', status: waStatus });
  const { phone, text, images=[] } = req.body;
  if (!phone) return res.status(400).json({ error: 'חסר מספר טלפון' });
  const chatId = formatPhone(phone);
  const results = [];
  try {
    await client.sendMessage(chatId, text);
    results.push({ type:'text', ok:true });
    for (const img of images) {
      if (!img || (!img.url && !img.base64)) continue;
      try {
        let media;
        if (img.base64) {
          const [header,data] = img.base64.split(',');
          const mime = header.match(/:(.*?);/)[1];
          media = new MessageMedia(mime, data, (img.name||'product')+'.jpg');
        } else {
          media = await MessageMedia.fromUrl(img.url, { unsafeMime: true });
        }
        await client.sendMessage(chatId, media);
        results.push({ type:'image', name:img.name, ok:true });
        await delay(700);
      } catch(e) {
        results.push({ type:'image', name:img.name, ok:false, error:e.message });
      }
    }
    res.json({ success:true, total:results.length, failed:results.filter(r=>!r.ok).length, results });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /sheets-sync — Sheets → KShop ────────────────────
// גישה ב': מק"ט ייחודי → עדכון; מק"ט משותף → מדלג (KShop הוא מקור האמת)
app.post('/sheets-sync', requireToken, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase לא מוגדר' });

  const { sku, qty_old, qty_new } = req.body;
  if (!sku) return res.status(400).json({ error: 'חסר SKU' });

  if (syncLock.has(sku)) {
    syncLock.delete(sku);
    addLog(`echo blocked: ${sku}`);
    return res.json({ success: true, echo: true });
  }

  try {
    const { data: rows } = await supabaseAdmin
      .from('products')
      .select('id, warehouse_qty')
      .eq('sku', sku);

    if (!rows || rows.length === 0) {
      addLog(`SKU לא נמצא: ${sku}`);
      return res.status(404).json({ error: 'מוצר לא נמצא', sku });
    }

    if (rows.length > 1) {
      addLog(`SKU משותף — דלג: ${sku} (${rows.length} מוצרים, עדכן ב-KShop ישירות)`);
      return res.json({ success: true, skipped: true, reason: 'multiple_products', count: rows.length });
    }

    const product = rows[0];
    let wqty = {};
    try { wqty = product.warehouse_qty ? JSON.parse(product.warehouse_qty) : {}; } catch {}

    wqty[WH_OLD] = Number(qty_old) || 0;
    wqty[WH_NEW] = Number(qty_new) || 0;
    const totalQty = Object.values(wqty).reduce((a, b) => a + (Number(b) || 0), 0);

    await supabaseAdmin
      .from('products')
      .update({
        warehouse_qty: JSON.stringify(wqty),
        quantity: totalQty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id);

    addLog(`sheets→kshop: ${sku} old=${qty_old} new=${qty_new}`);
    res.json({ success: true });
  } catch(e) {
    addLog('שגיאה /sheets-sync: ' + e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /kshop-updated — KShop → Sheets ──────────────────
// מחזיר תשובה מיד ומעלה ל-Sheets ב-background
app.post('/kshop-updated', requireToken, async (req, res) => {
  const { sku, name } = req.body;
  if (!sku) return res.status(400).json({ error: 'חסר SKU' });

  syncLock.add(sku);
  setTimeout(() => syncLock.delete(sku), 5000);

  res.json({ success: true, queued: true });

  // background — לא חוסם את ה-browser
  (async () => {
    let qty_old = req.body.qty_old || 0;
    let qty_new = req.body.qty_new || 0;

    if (supabaseAdmin) {
      try {
        const { data: rows } = await supabaseAdmin
          .from('products')
          .select('warehouse_qty')
          .eq('sku', sku);

        if (rows && rows.length > 1) {
          qty_old = 0; qty_new = 0;
          for (const p of rows) {
            let wqty = {};
            try { wqty = p.warehouse_qty ? JSON.parse(p.warehouse_qty) : {}; } catch {}
            qty_old += Number(wqty[WH_OLD]) || 0;
            qty_new += Number(wqty[WH_NEW]) || 0;
          }
        }
      } catch(e) { addLog('שגיאה בסכימת SKU: ' + e.message); }
    }

    const ok = await pushToSheets('update', { sku, name, qty_old, qty_new });
    addLog(`kshop→sheets: ${sku} old=${qty_old} new=${qty_new} ok=${ok}`);
  })();
});

// ── POST /sheets-full-sync — דחף הכל ל-Sheets ─────────────
// מקבץ לפי מק"ט ושולח סכום לכל שורה
app.post('/sheets-full-sync', requireToken, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase לא מוגדר' });

  const customUrl = req.body && req.body.apps_script_url;

  try {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('name, sku, warehouse_qty')
      .not('sku', 'is', null)
      .neq('sku', '');

    if (!products || products.length === 0) return res.json({ success: true, synced: 0, total: 0 });

    const skuMap = {};
    for (const p of products) {
      if (!skuMap[p.sku]) skuMap[p.sku] = { sku: p.sku, name: p.name, qty_old: 0, qty_new: 0 };
      let wqty = {};
      try { wqty = p.warehouse_qty ? JSON.parse(p.warehouse_qty) : {}; } catch {}
      skuMap[p.sku].qty_old += Number(wqty[WH_OLD]) || 0;
      skuMap[p.sku].qty_new += Number(wqty[WH_NEW]) || 0;
    }

    const items = Object.values(skuMap);
    const ok = await pushToSheets('batch_update', { items }, customUrl);
    const synced = ok ? items.length : 0;

    addLog(`full-sync: ${synced}/${items.length} מק"טים (batch)`);
    res.json({ success: true, synced, total: items.length });
  } catch(e) {
    addLog('שגיאה full-sync: ' + e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /sheets-import — Sheets → KShop (ייבוא מלא) ──────
app.post('/sheets-import', requireToken, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase לא מוגדר' });

  const customUrl = (req.body && req.body.apps_script_url) || APPS_SCRIPT_URL;
  if (!customUrl) return res.status(503).json({ error: 'Apps Script URL לא מוגדר' });

  const importCtrl = new AbortController();
  const importTimer = setTimeout(() => importCtrl.abort(), 60000);
  try {
    const resp = await fetch(customUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'get_all', token: API_TOKEN }),
      signal:  importCtrl.signal,
    });
    clearTimeout(importTimer);
    const data = await resp.json();
    if (!data.rows) return res.status(500).json({ error: 'לא התקבלו נתונים מ-Sheets' });

    let updated = 0, skipped = 0, notFound = 0;

    for (const row of data.rows) {
      if (!row.sku) continue;

      const { data: rows } = await supabaseAdmin
        .from('products')
        .select('id, warehouse_qty')
        .eq('sku', row.sku);

      if (!rows || rows.length === 0) { notFound++; continue; }
      if (rows.length > 1)            { skipped++;  continue; }

      const product = rows[0];
      let wqty = {};
      try { wqty = product.warehouse_qty ? JSON.parse(product.warehouse_qty) : {}; } catch {}
      wqty[WH_OLD] = Number(row.qty_old) || 0;
      wqty[WH_NEW] = Number(row.qty_new) || 0;
      const totalQty = Object.values(wqty).reduce((a, b) => a + (Number(b) || 0), 0);

      await supabaseAdmin
        .from('products')
        .update({
          warehouse_qty: JSON.stringify(wqty),
          quantity:      totalQty,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', product.id);

      updated++;
    }

    addLog(`sheets-import: ${updated} עודכנו, ${skipped} דולגו (מרובי מק"ט), ${notFound} לא נמצאו`);
    res.json({ success: true, updated, skipped, notFound, total: data.rows.length });
  } catch(e) {
    addLog('שגיאה sheets-import: ' + e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /sheets-missing — מק"טים ב-Sheets שאין ב-KShop ────
app.get('/sheets-missing', requireToken, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase לא מוגדר' });
  if (!APPS_SCRIPT_URL) return res.status(503).json({ error: 'Apps Script URL לא מוגדר' });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ action: 'get_all', token: API_TOKEN }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const data = await resp.json();
    if (!data.rows) return res.status(500).json({ error: 'לא התקבלו נתונים מ-Sheets' });

    const sheetRows = data.rows.filter(r => r.sku);
    const uniqueSheetSkus = [...new Set(sheetRows.map(r => String(r.sku).trim()))];

    const { data: products } = await supabaseAdmin
      .from('products')
      .select('sku, name')
      .not('sku', 'is', null)
      .neq('sku', '');

    const kshopSkus = new Set((products || []).map(p => String(p.sku).trim()));
    const missing = uniqueSheetSkus
      .filter(sku => !kshopSkus.has(sku))
      .map(sku => {
        const row = sheetRows.find(r => String(r.sku).trim() === sku);
        return {
          sku,
          name:    row ? row.name    : '',
          qty_old: row ? (row.qty_old || 0) : 0,
          qty_new: row ? (row.qty_new || 0) : 0,
        };
      })
      .sort((a, b) => (b.qty_old + b.qty_new) - (a.qty_old + a.qty_new));

    res.json({ missing, total_sheets: uniqueSheetSkus.length, total_kshop: kshopSkus.size });
  } catch(e) {
    clearTimeout(t);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /sheets-status ─────────────────────────────────────
app.get('/sheets-status', requireToken, (req, res) => {
  res.json({ log: syncLog, lock_size: syncLock.size });
});

// ── Start ──────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('K-Shop Server פועל על פורט ' + PORT);
  console.log('='.repeat(50));
  console.log('\n🔑 API TOKEN – העתק להגדרות:');
  console.log('\n   ' + API_TOKEN + '\n');
  console.log('='.repeat(50) + '\n');
});
