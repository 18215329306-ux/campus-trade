-- ===== 在 Supabase SQL Editor 中执行以下语句 =====

-- 1. 创建交易确认表
CREATE TABLE IF NOT EXISTS deals (
  id BIGSERIAL PRIMARY KEY,
  goods_id BIGINT REFERENCES goods(id) ON DELETE CASCADE,
  seller_id BIGINT REFERENCES users(id),
  buyer_id BIGINT REFERENCES users(id),
  final_price NUMERIC NOT NULL,
  seller_note TEXT DEFAULT '',
  buyer_note TEXT DEFAULT '',
  seller_confirmed BOOLEAN DEFAULT true,
  buyer_confirmed BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. deals 表增加星级评分的列
ALTER TABLE deals ADD COLUMN IF NOT EXISTS seller_rating INT CHECK (seller_rating >= 1 AND seller_rating <= 5);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS buyer_rating INT CHECK (buyer_rating >= 1 AND buyer_rating <= 5);

-- 3. users 表增加信誉评分
ALTER TABLE users ADD COLUMN IF NOT EXISTS reputation NUMERIC DEFAULT 5.0;

-- 4. 用户关注表
CREATE TABLE IF NOT EXISTS follows (
  id BIGSERIAL PRIMARY KEY,
  follower_id BIGINT REFERENCES users(id),
  following_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- 5. 用户互评表
CREATE TABLE IF NOT EXISTS user_reviews (
  id BIGSERIAL PRIMARY KEY,
  reviewer_id BIGINT REFERENCES users(id),
  target_id BIGINT REFERENCES users(id),
  rating INT CHECK (rating >= 1 AND rating <= 5),
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);


-- 6. 评分改为 0.5 刻度（先删旧约束，再加新的）
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_seller_rating_check;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_buyer_rating_check;
ALTER TABLE deals ADD CONSTRAINT deals_seller_rating_check CHECK (seller_rating >= 0.5 AND seller_rating <= 5.0);
ALTER TABLE deals ADD CONSTRAINT deals_buyer_rating_check CHECK (buyer_rating >= 0.5 AND buyer_rating <= 5.0);

-- 7. 信誉分变更日志表
CREATE TABLE IF NOT EXISTS reputation_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  change NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
