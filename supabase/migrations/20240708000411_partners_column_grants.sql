-- ============================================================================
-- PARTNERS: SHARTNOMA USTUNLARINI ANON DAN YOPISH (to'g'ri usul)
-- ============================================================================
-- Oldingi migratsiyada faqat `REVOKE SELECT (ustun)` yozilgan edi va u
-- ISHLAMADI. Sabab: PostgreSQL da JADVAL darajasidagi SELECT huquqi
-- barcha ustunlarni qamrab oladi — ustun darajasidagi revoke uning
-- ustidan o'tolmaydi. Tekshirilganda shartnoma summasi hamon ochiq edi:
--   {"name":"ghost","contract_no":"1231312","contract_amount":13132109.00}
--
-- TO'G'RI TARTIB: avval jadval darajasidagi huquqni olib tashlash, keyin
-- faqat XAVFSIZ ustunlarga huquq berish.
--
-- Sayt buzilmaydi: ommaviy sahifalar hamkorlarni `public-partners` edge
-- funksiyasi orqali, service role bilan o'qiydi va u bu cheklovga
-- bo'ysunmaydi. Hamkor kabineti ham shunday — `me-partner` orqali.
-- ============================================================================

REVOKE SELECT ON public.partners FROM anon, authenticated;

GRANT SELECT (
  id, name, slug, sphere, logo, direction,
  status, is_featured, sort_order, translations,
  created_at, updated_at, deleted_at
) ON public.partners TO anon, authenticated;

-- Yopiq qolganlar: contract_no, contract_amount, signed_date,
-- client_profile_id, created_by, updated_by, deleted_by
