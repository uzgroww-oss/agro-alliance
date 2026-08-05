-- ============================================================================
-- ANON KALIT KO'RA OLADIGAN USTUNLARNI CHEKLASH
-- ============================================================================
-- MUAMMO: `anon` kaliti saytning JavaScript faylida ochiq turadi — uni
-- istalgan tashrifchi olib, PostgREST ga to'g'ridan-to'g'ri so'rov yubora
-- oladi. RLS satrlarni himoya qiladi, lekin USTUNLARNI emas.
--
-- Tekshiruvda quyidagilar ochiq ekani aniqlandi:
--   partners.contract_no, contract_amount, signed_date, client_profile_id
--     -> hamkorlarning shartnoma summalari (masalan 13 132 109 so'm) va
--        ichki profil identifikatorlari hammaga ko'rinardi;
--   roles, permissions, role_permissions
--     -> butun ruxsatlar tizimining tuzilishi ochiq edi.
--
-- YECHIM: ustun darajasidagi huquqlar. RLS bunga yaramaydi — u satr
-- darajasida ishlaydi. Ommaviy sahifalar bu maydonlarni baribir
-- ishlatmaydi: ular edge funksiyalar orqali, service role bilan
-- o'qiladi va o'sha yerda faqat xavfsiz maydonlar tanlanadi.
-- ============================================================================

-- --- partners: maxfiy ustunlar ---
REVOKE SELECT (contract_no, contract_amount, signed_date, client_profile_id)
  ON public.partners FROM anon;
REVOKE SELECT (contract_no, contract_amount, signed_date, client_profile_id)
  ON public.partners FROM authenticated;

-- --- ruxsatlar tizimi: mijozga umuman kerak emas ---
-- Admin paneli bularni `admin-roles-list` / `admin-permissions-list`
-- funksiyalari orqali, service role bilan o'qiydi.
REVOKE SELECT ON public.roles FROM anon, authenticated;
REVOKE SELECT ON public.permissions FROM anon, authenticated;
REVOKE SELECT ON public.role_permissions FROM anon, authenticated;

-- Kelajakda qo'shiladigan ustunlar ham avtomatik ochilib ketmasin:
-- yangi ustun qo'shilganda unga huquq alohida beriladi.
