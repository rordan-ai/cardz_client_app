-- ============================================
-- NFC Punch Feature - Supabase Schema
-- ============================================

-- 1. הוספת עמודות לטבלת businesses
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS nfc_string VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS punch_mode VARCHAR(20) DEFAULT 'manual';

-- punch_mode values: 'manual', 'semi_auto', 'auto'

COMMENT ON COLUMN businesses.nfc_string IS 'מחרוזת NFC ייחודית לעסק - נקבעת על ידי האדמין';
COMMENT ON COLUMN businesses.punch_mode IS 'מצב ניקוב: manual=ידני, semi_auto=חצי אוטומטי, auto=אוטומטי';

-- 2. טבלת בקשות ניקוב (Realtime)
CREATE TABLE IF NOT EXISTS punch_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id INT REFERENCES businesses(id) ON DELETE CASCADE,
  customer_phone VARCHAR(20) NOT NULL,
  card_id INT NOT NULL,
  product_name VARCHAR(100),
  is_prepaid BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending',
  -- status values: 'pending', 'approved', 'rejected', 'completed', 'timeout'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(50) -- 'admin' or 'auto'
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_punch_requests_business ON punch_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_punch_requests_status ON punch_requests(status);
CREATE INDEX IF NOT EXISTS idx_punch_requests_created ON punch_requests(created_at);

-- RLS
ALTER TABLE punch_requests ENABLE ROW LEVEL SECURITY;

-- מדיניות: אדמין רואה בקשות של העסק שלו
CREATE POLICY "Admin can view own business requests" ON punch_requests
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE admin_id = auth.uid())
  );

-- מדיניות: לקוח יכול ליצור בקשה
CREATE POLICY "Anyone can create punch request" ON punch_requests
  FOR INSERT WITH CHECK (true);

-- מדיניות: אדמין יכול לעדכן בקשות של העסק שלו
CREATE POLICY "Admin can update own business requests" ON punch_requests
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE admin_id = auth.uid())
  );

-- 3. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE punch_requests;

-- 4. פונקציה לבדיקת כפילות מחרוזת NFC
CREATE OR REPLACE FUNCTION check_nfc_string_exists(nfc_str VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM businesses WHERE nfc_string = nfc_str);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. פונקציה לניקוי בקשות ישנות (timeout)
CREATE OR REPLACE FUNCTION cleanup_old_punch_requests()
RETURNS void AS $$
BEGIN
  UPDATE punch_requests 
  SET status = 'timeout', resolved_at = now()
  WHERE status = 'pending' 
    AND created_at < now() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

