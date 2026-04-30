-- ============================================================
-- K-Shop – Supabase Schema
-- הרץ את הקוד הזה בעורך ה-SQL של Supabase
-- ============================================================

-- ── 1. טבלת מוצרים ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id             TEXT        PRIMARY KEY,
  name           TEXT        NOT NULL,
  category       TEXT,
  dimensions     TEXT,
  "costPrice"    NUMERIC     DEFAULT 0,
  warehouse      TEXT,
  quantity       INTEGER     DEFAULT 0,
  "futureQty"    INTEGER     DEFAULT 0,
  "futureDate"   TEXT,
  image          TEXT,
  sku            TEXT,
  display_order  INTEGER     DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. טבלת הגדרות (קטגוריות, מספר וואטסאפ וכו') ─────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT
);

-- ── 3. RLS – אפשר קריאה וכתיבה דרך anon key ──────────────────
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- מחק policies קיימות אם יש (כדי למנוע שגיאות כפל)
DROP POLICY IF EXISTS "anon_all_products"     ON products;
DROP POLICY IF EXISTS "anon_all_settings"     ON app_settings;

CREATE POLICY "anon_all_products"
  ON products
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_all_settings"
  ON app_settings
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ── 4. Trigger לעדכון updated_at אוטומטי ─────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON products;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
