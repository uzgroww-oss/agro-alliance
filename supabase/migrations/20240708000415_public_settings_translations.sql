-- ============================================================================
-- SOZLAMA QIYMATLARINI TARJIMA QILISH
-- ============================================================================
-- `public_settings` da matn qiymatlari bor va ular saytda ko'rinadi:
-- ish vaqti ("Dushanba - Shanba, 09:00 - 18:00"), manzil, sayt tavsifi.
-- Ular til almashtirilganda ham o'zbekcha qolaverardi — chunki bu
-- jadvalda tarjima ustuni yo'q edi.
--
-- Boshqa jadvallardagi kabi `translations` JSONB qo'shiladi:
--   { "ru": {"value": "..."}, "en": {...}, "zh": {...}, "_manual": true }
--
-- HAMMA SOZLAMA TARJIMA QILINMAYDI: havolalar, rasm yo'llari, telefon,
-- email va brend nomi barcha tillarda bir xil qoladi.
-- ============================================================================

ALTER TABLE public.public_settings
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.public_settings.translations IS
  'Qo''lda kiritilgan tarjimalar. Shakl: {"ru":{"value":"..."},"en":{...},"zh":{...},"_manual":true}';

-- Ustun anon uchun ochiq bo'lsin: `public-settings` funksiyasi service
-- role bilan o'qiydi, lekin ustun huquqlari jadval bo'yicha berilgan
-- va yangi ustun avtomatik qo'shilmasligi mumkin.
GRANT SELECT (translations) ON public.public_settings TO anon, authenticated;
