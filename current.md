# KShop — מצב נוכחי

## קבצים
| קובץ | תיאור |
|------|--------|
| `index.html` | אפליקציה ראשית — ייצור (2589 שורות) |
| `server.js` | שרת WhatsApp (Node.js + whatsapp-web.js) |
| `current.md` | המסמך הזה |

---

## סופאבייס

| סביבה | Project ID | הערות |
|--------|-----------|--------|
| **ייצור** | `vtrzxykuhacrlqzgdbfe` | ❗ לא לגעת |

---

## ארכיטקטורה טכנית

- **React 18** — CDN + Babel Standalone (ללא build)
- **Tailwind CSS** — CDN
- **html2canvas 1.4.1** — לצילום DOM לשליחת PDF לוואטסאפ
- **jsPDF 2.5.1** — יצירת PDF מה-canvas
- **Supabase JS v2** — auth + database
- **Single-file HTML** — הכל בקובץ אחד

### טבלאות בסופאבייס
- `products` — מוצרים
- `contacts` — אנשי קשר
- `app_settings` — הגדרות (company_name, whatsapp_number, logo_url)

### RLS
כל הטבלאות מוגנות עם Row Level Security — גישה רק ל-authenticated users.

---

## פיצ'רים קיימים

### WhatsApp Modal
- בניית טקסט אוטומטי מהמוצרים הנבחרים
- עריכת הטקסט לפני שליחה (textarea)
- שליחה דרך שרת Node.js (`/send` endpoint)
- fallback ידני: copy + פתיחת wa.me

### מחירון PDF (`PricingModal`) ✅ מושלם
- הזנת מחיר לכל מוצר
- **Toggle מע"מ 18%** — חישוב אוטומטי עם תצוגת מחיר עם מע"מ ליד כל שדה
- **משפטים שמורים** — רשימה עם צ'קבוקסים, נשמר ב-localStorage כ-`kshop_pdf_clauses`
  - פורמט: `[{ id, text, enabled }]`
  - 5 ברירות מחדל + הוספה/מחיקה ידנית
  - המשפטים הפעילים מופיעים מתחת לטבלה במחירון
- הדפסה / שמירת PDF דרך `window.print()`
- **שליחת PDF לוואטסאפ** — html2canvas → jsPDF → base64 → שרת `/send`
  - כפתור "שלח לוואטסאפ" פותח שדה טלפון
  - שולח `{ name: 'מחירון.pdf', base64: 'data:application/pdf;base64,...' }`

### שרת WhatsApp
- Token validation (`x-kshop-token` header)
- כתובת ngrok נשמרת ב-`localStorage.kshop_server_url`
- פורמט שליחת תמונות ו-PDF זהה — mime נשלף מ-data URI
- **תוקן**: filename לא מקבל `.jpg` — משתמש ב-`img.name` ישירות

---

## localStorage Keys
| מפתח | תוכן |
|------|------|
| `kshop_whatsapp_number` | מספר ברירת מחדל לשליחה |
| `kshop_server_url` | כתובת שרת WhatsApp |
| `kshop_api_token` | API token לשרת |
| `kshop_pdf_clauses` | משפטים שמורים לPDF (JSON) |

---

## סשנים קודמים
1. בניית המערכת הראשית (מוצרים, auth, categories, warehouses)
2. אבטחה: RLS, XSS, Supabase Auth אמיתי
3. פיצ'ר PDF מחירון (בסיס)
4. גיבוי staging + פיצ'רים: עריכת WhatsApp, מע"מ, משפטים שמורים, שליחת PDF לוואטסאפ ✅
