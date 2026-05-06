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

### Mac (workspace)
- `/Users/liran/claude /K-Shop/deploy/index.html` — קובץ ה-frontend לפריסה
- `/Users/liran/claude /K-Shop/kshop-wa-server/server.js` — גרסת השרת (לעדכונים)
- `/Users/liran/claude /K-Shop/deploy-to-cloudflare.command` — סקריפט פריסה ל-Cloudflare Pages
- `/Users/liran/claude /K-Shop/deploy-worker.command` — סקריפט פריסה ל-Worker

### Windows (במשרד)
- `C:\Users\liran\Desktop\kshop-final\kshop-server\server.js` — השרת הפעיל
- `C:\Users\liran\Desktop\kshop-final\kshop-server\api-token.txt` — ה-API Token
- `C:\Users\liran\Desktop\kshop-final\kshop-server\ww-session\` — סשן הוואטסאפ

## אבטחה

- server.js כבר מאובטח עם requireToken middleware — token נשמר ב-api-token.txt
- Supabase RLS מופעל על כל הטבלאות (products, contacts, app_settings) ✅
- API Token של K-Shop (localStorage): 43c1745030c25ec9ba6ba2099acdd600a188bb7eae8facea

## Cloudflare

- Account ID: 6b2632ec4dcb56f740c3ed94537cdb81
- API Token: cfut_RDPUbg7yQIglAfFSr9W9KCRdcLAO0CAzwwYndnxZ6294e85b
- Pages project name: kshop
- Worker name: mute-mountain-de5c

## מה הושלם

- ✅ RLS ב-Supabase
- ✅ Deploy ל-Cloudflare Pages (kshop.pages.dev)
- ✅ Deploy ל-Cloudflare Worker (proxy)
- ✅ תיקון CORS עם ngrok-skip-browser-warning header
- ✅ תיקון כתובת שרת: ngrok-free.dev (לא .app ולא Railway)
- ✅ server.js מאובטח עם token validation
