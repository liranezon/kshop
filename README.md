# K-Shop – מערכת ניהול מלאי

מערכת ניהול מלאי לאטרקציות מתנפחות – K-Shop.

## טכנולוגיות
- **Frontend**: React 18 (CDN), Tailwind CSS, Babel Standalone
- **Backend / DB**: Supabase (PostgreSQL + Auth + RLS)
- **Hosting**: Cloudflare Workers / Pages

## קבצים
| קובץ | תיאור |
|------|--------|
| `index.html` | האפליקציה המלאה (קוד מקור) |
| `supabase-schema.sql` | Schema ליצירת פרויקט Supabase חדש |
| `kshop-backup-2026-04-29.sql` | גיבוי מלא של בסיס הנתונים (209 מוצרים) |

## הרצה מקומית
פתח את `index.html` בדפדפן – ללא צורך ב-build.

## פריסה ל-Cloudflare Workers
```bash
wrangler pages deploy . --project-name kshop
```

## Supabase – הגדרה ראשונית
1. צור פרויקט חדש ב-[Supabase](https://app.supabase.com)
2. הרץ `supabase-schema.sql` ב-SQL Editor
3. הרץ `kshop-backup-2026-04-29.sql` לייבוא נתונים
4. עדכן את `SUPABASE_URL` ו-`SUPABASE_ANON_KEY` ב-`index.html`

## גרסה
- Backup: 2026-04-29
- מוצרים: 209
- Supabase Project: vtrzxykuhacrlqzgdbfe (production)
