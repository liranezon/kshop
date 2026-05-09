/**
 * K-Shop – WhatsApp Automation Server
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
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
          media = new MessageMedia(mime, data, img.name || 'product.jpg');
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
