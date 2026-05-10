# KShop — מצב נוכחי

## קבצים
| קובץ | תיאור |
|------|--------|
| `index.html` | אפליקציה ראשית — ייצור (2782 שורות, ~200KB) |
| `server.js` | שרת WhatsApp (Node.js + whatsapp-web.js) |
| `Logo.jpeg` | לוגו K-Shop — מוטמע כ-base64 בתוך index.html |
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
- **Single-file HTML** — הכל בקובץ index.html אחד

### טבלאות בסופאבייס
- `products` — מוצרים
- `contacts` — אנשי קשר
- `app_settings` — הגדרות (company_name, whatsapp_number, logo_url, warehouses)

### RLS
כל הטבלאות מוגנות עם Row Level Security — גישה רק ל-authenticated users.

---

## פיצ'רים קיימים

### WhatsApp Modal
- בניית טקסט אוטומטי מהמוצרים הנבחרים
- עריכת הטקסט לפני שליחה (textarea)
- שליחה דרך שרת Node.js (`/send` endpoint)
- fallback ידני: copy + פתיחת wa.me

### מחירון PDF (`PricingModal`)
- הזנת מחיר לכל מוצר נבחר
- Toggle מע"מ 18% עם חישוב אוטומטי
- טבלת סיכום VAT: סכום לפני מע"מ / מע"מ 18% / סך הכל
- משפטים שמורים עם צ'קבוקסים — `localStorage: kshop_pdf_clauses`
- לוגו K-Shop מוטמע כ-base64 בראש ה-PDF
- כותרת: "הצעת מחיר — קיי שופ און ליין בע"מ"
- עיצוב טבלה מקצועי: מספור שורות, גבול אדום בכותרת
- הדפסה / שמירת PDF דרך `window.print()`
- שליחת PDF לוואטסאפ: html2canvas → jsPDF → base64 → `/send`

### שרת WhatsApp
- Token validation (`x-kshop-token` header)
- כתובת ngrok נשמרת ב-`localStorage.kshop_server_url`
- פורמט שליחת תמונות ו-PDF זהה — mime נשלף מ-data URI

---

## עיצוב ו-UI (עדכון אחרון — מאי 2026)

### Palette
- **ראשי:** `gray-900` (כפתורים, בחירה, active state) — אפס indigo
- **הצלחה:** green / WhatsApp green
- **הרסני:** red-500/600
- **טקסט:** gray-800 כותרות, gray-600 משני, gray-400 placeholder

### קומפוננטות
- **Header** — dark rounded square עם cart SVG, gear SVG במקום ⚙️
- **Search bar** — SVG magnifying glass, bg-gray-50 focus → white
- **CategoryFilter** — active: `bg-gray-900`, inactive: border + hover
- **ProductCard** — `ring-gray-900`, shadow-lg hover, lift `-translate-y-0.5`, 200ms
- **Empty state** — SVG bag icon + כפתור gray-900
- **Bottom bar** — WhatsApp SVG logo, PDF document SVG

### Toast Notifications
- Component: `<Toast toasts={toasts} />`
- State: `const [toasts, setToasts] = useState([])`
- Helper: `showToast(msg, type)` — type: `'success'` | `'warning'` | `'error'`
- מחובר ל: שמירת מוצר, מחיקת מוצר, שמירה לענן, טעינה מענן
- אנימציה: slide-in מהעליון (CSS: `toast-enter` / `toast-exit`)

### Modal Animations
- כל 5 מודאלים: `modal-backdrop` (fade) + `modal-panel` (slide-up + scale)
- CSS: `@keyframes modal-backdrop-in` + `@keyframes modal-panel-in`

### SVG Icons (במקום אמוג'י)
- Settings gear, Search, Cloud save/load, WhatsApp logo
- PDF document, Image placeholder, Close ×, Modal headers

---

## localStorage Keys
| מפתח | תוכן |
|------|------|
| `kshop_whatsapp_number` | מספר ברירת מחדל לשליחה |
| `kshop_server_url` | כתובת שרת WhatsApp |
| `kshop_api_token` | API token לשרת |
| `kshop_pdf_clauses` | משפטים שמורים לPDF — `[{ id, text, enabled }]` |
| `kshop_categories` | קטגוריות מותאמות אישית |
| `kshop_warehouses` | מחסנים — `[{ key, label }]` |

---

## סשנים קודמים
1. בניית המערכת הראשית (מוצרים, auth, categories, warehouses)
2. אבטחה: RLS, XSS, Supabase Auth אמיתי
3. פיצ'ר PDF מחירון (בסיס)
4. גיבוי staging + פיצ'רים: עריכת WhatsApp, מע"מ, משפטים שמורים, שליחת PDF
5. PDF redesign: לוגו מוטמע + טבלה מקצועית + כותרת קיי שופ + VAT summary
6. **UI Polish מלא** — palette gray-900, SVG icons, toast notifications, modal animations, search bar, card depth, empty states
