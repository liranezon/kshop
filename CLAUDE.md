# K-Shop – מפת מערכת לקלוד

> קרא את הקובץ הזה בתחילת כל שיחה לפני שעושה כל דבר.

## ארכיטקטורה

| שכבה | שירות | כתובת |
|------|--------|--------|
| Frontend | Cloudflare Pages | https://kshop.pages.dev |
| Frontend (חלופי) | Cloudflare Worker (proxy בלבד) | https://mute-mountain-de5c.ezonliran.workers.dev |
| Database | Supabase (PostgreSQL) | https://vtrzxykuhacrlqzgdbfe.supabase.co |
| WhatsApp Server | Node.js + whatsapp-web.js | מחשב Windows במשרד, פורט 3001 |
| Tunnel | ngrok (static domain) | https://landmine-thumb-stegosaur.ngrok-free.dev |

## חשוב מאוד — אל תטעה בזה

- השרת רץ תמיד על **מחשב Windows במשרד** — לא בענן, לא Railway, לא שום מקום אחר
- **Railway = נכשל, לא בשימוש כלל** — אל תציע אותו
- ה-Cloudflare Worker הוא **proxy בלבד** — מעביר בקשות ל-kshop.pages.dev, לא מריץ לוגיקה
- אל תחליף את server.js בגרסה עם Baileys — השרת משתמש ב-`whatsapp-web.js`

## קבצים חשובים

### סביבת העבודה הנוכחית (Windows — kshop-project)
- `index.html` — האפליקציה הראשית (single-file, React 18 + Tailwind CDN)
- `server.js` — שרת WhatsApp (Node.js + whatsapp-web.js)
- `current.md` — תיעוד מפורט של המצב הנוכחי: פיצ'רים, localStorage keys, ארכיטקטורה

### Windows (שרת פעיל במשרד)
- `C:\Users\liran\Desktop\kshop-final\kshop-server\server.js` — השרת הפעיל
- `C:\Users\liran\Desktop\kshop-final\kshop-server\api-token.txt` — ה-API Token
- `C:\Users\liran\Desktop\kshop-final\kshop-server\ww-session\` — סשן הוואטסאפ

### סקריפטי פריסה (Mac)
- `/Users/liran/claude /K-Shop/deploy-to-cloudflare.command` — פריסה ל-Cloudflare Pages
- `/Users/liran/claude /K-Shop/deploy-worker.command` — פריסה ל-Worker

## טכנולוגיות Frontend

- **React 18** — CDN + Babel Standalone (ללא build)
- **Tailwind CSS** — CDN
- **html2canvas 1.4.1** — לצילום DOM לשליחת PDF
- **jsPDF 2.5.1** — יצירת PDF מה-canvas
- **Supabase JS v2** — auth + database
- **Single-file HTML** — הכל בקובץ index.html אחד

## אבטחה

- server.js מאובטח עם requireToken middleware — token נשמר ב-api-token.txt
- Supabase RLS מופעל על כל הטבלאות (products, contacts, app_settings) ✅
- API Token של K-Shop (localStorage): 43c1745030c25ec9ba6ba2099acdd600a188bb7eae8facea

## Cloudflare

- Account ID: 6b2632ec4dcb56f740c3ed94537cdb81
- API Token: [שמור בנפרד — לא בקוד]
- Pages project name: kshop
- Worker name: mute-mountain-de5c

## מה הושלם

- ✅ RLS ב-Supabase
- ✅ Deploy ל-Cloudflare Pages (kshop.pages.dev)
- ✅ Deploy ל-Cloudflare Worker (proxy)
- ✅ תיקון CORS עם ngrok-skip-browser-warning header
- ✅ תיקון כתובת שרת: ngrok-free.dev (לא .app ולא Railway)
- ✅ server.js מאובטח עם token validation
- ✅ PricingModal — מחירון PDF מלא:
  - Toggle מע"מ 18% עם חישוב אוטומטי
  - משפטים שמורים (localStorage: `kshop_pdf_clauses`) עם הוספה/מחיקה
  - הדפסה / שמירת PDF דרך `window.print()`
  - שליחת PDF לוואטסאפ: html2canvas → jsPDF → base64 → שרת `/send`
- ✅ תיקון באג: filename לא מקבל סיומת שגויה — משתמש ב-`img.name` ישירות
