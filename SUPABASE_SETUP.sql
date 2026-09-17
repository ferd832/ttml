-- SQL для создания таблицы кодов приглашения в Supabase
-- Выполните этот SQL в Supabase SQL Editor

-- Создание таблицы invite_codes
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Включение RLS (Row Level Security)
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать неиспользованные коды (для проверки при регистрации)
CREATE POLICY "Anyone can check unused codes"
  ON invite_codes FOR SELECT
  USING (used_by IS NULL);

-- Политика: только аутентифицированные пользователи могут обновлять коды
CREATE POLICY "Authenticated users can update codes"
  ON invite_codes FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Пример создания кодов приглашения
-- Выполните эти INSERT для создания кодов:

INSERT INTO invite_codes (code) VALUES 
  ('PLANET2026'),
  ('MUSIC2026'),
  ('STUDIO2026');

-- Для генерации случайных кодов можно использовать:
-- INSERT INTO invite_codes (code) VALUES (upper(substr(md5(random()::text), 1, 8)));
