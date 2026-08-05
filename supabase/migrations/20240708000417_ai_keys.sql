-- ============================================================================
-- AI KALITLARINI PANELDAN BOSHQARISH
-- ============================================================================
-- MUAMMO: AI kalitlari faqat Supabase Secrets'da (Deno env) turadi. Kalit
-- tugasa yoki kvota bitsa, muharrir hech narsa qila olmaydi — terminalga
-- kirib `supabase secrets set` yozish kerak, keyin funksiyalarni qayta
-- deploy qilish kerak. Amalda bu "AI ishlamay qoldi" degani.
--
-- YECHIM: kalitlar paneldan qo'shiladi va o'chiriladi. Kalitning O'ZI
-- Vault'da shifrlangan holda yotadi — `ai_keys` jadvalida faqat metama'lumot
-- (qaysi provayder, nomi, oxirgi 4 belgi) bo'ladi.
--
-- NEGA JADVALGA OCHIQ YOZILMADI: jadvalni o'qiy oladigan har qanday
-- xato huquq (yoki kelajakdagi RLS xatosi) hamma kalitni oshkor qilardi.
-- Vault'da esa kalit shifrlangan va uni faqat security-definer funksiya
-- ocha oladi.
-- ============================================================================

create extension if not exists supabase_vault with schema vault;

create table if not exists public.ai_keys (
  id          uuid primary key default gen_random_uuid(),
  -- gemini | groq | cloudflare | openai ...
  provayder   text not null,
  -- Muharrir yozadigan nom: "Asosiy hisob", "Zaxira" — kalitni ajratish uchun
  nom         text not null default '',
  -- Vault'dagi maxfiy nomi. Kalitning o'zi SHU YERDA EMAS.
  vault_nom   text not null unique,
  -- Panelda ko'rsatish uchun: "…7f3a". To'liq kalit hech qachon qaytmaydi.
  oxirgi4     text not null default '',
  faol        boolean not null default true,
  -- Ketma-ketlik: kichik raqam oldin sinaladi
  tartib      integer not null default 100,
  -- Oxirgi marta qachon ishlatilgani va natijasi
  ishlatilgan timestamptz,
  oxirgi_xato text,
  created_at  timestamptz not null default now(),
  created_by  uuid
);

create index if not exists idx_ai_keys_provayder
  on public.ai_keys (provayder, faol, tartib);

alter table public.ai_keys enable row level security;
-- Siyosat ataylab yo'q: jadvalga faqat service_role (edge funksiya) kiradi.
-- Muharrir uni to'g'ridan-to'g'ri emas, edge funksiya orqali ko'radi.

-- ---------------------------------------------------------------------------
-- KALIT QO'SHISH
--
-- Kalit Vault'ga yoziladi, jadvalga esa faqat unga ishora tushadi.
-- ---------------------------------------------------------------------------
create or replace function public.ai_key_qoshish(
  p_provayder text,
  p_nom       text,
  p_qiymat    text,
  p_user      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_nom text;
  v_id  uuid;
begin
  if p_qiymat is null or length(trim(p_qiymat)) < 8 then
    raise exception 'Kalit juda qisqa';
  end if;

  -- Vault nomi yagona bo'lishi kerak; tasodifiy qo'shimcha bilan
  v_nom := 'ai_' || p_provayder || '_' || encode(gen_random_bytes(6), 'hex');

  perform vault.create_secret(trim(p_qiymat), v_nom, 'AI kaliti: ' || p_provayder);

  insert into public.ai_keys (provayder, nom, vault_nom, oxirgi4, created_by)
  values (
    p_provayder,
    coalesce(nullif(trim(p_nom), ''), p_provayder),
    v_nom,
    right(trim(p_qiymat), 4),
    p_user
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- FAOL KALITNI O'QISH
--
-- Provayder uchun eng ustuvor faol kalitni qaytaradi. Hech qanday
-- ro'yxat bermaydi — bittasini beradi, xolos.
-- ---------------------------------------------------------------------------
create or replace function public.ai_key_olish(p_provayder text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select s.decrypted_secret
  from public.ai_keys k
  join vault.decrypted_secrets s on s.name = k.vault_nom
  where k.provayder = p_provayder and k.faol
  order by k.tartib, k.created_at
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- KALITNI O'CHIRISH — Vault'dan ham, jadvaldan ham
-- ---------------------------------------------------------------------------
create or replace function public.ai_key_ochirish(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_nom text;
begin
  select vault_nom into v_nom from public.ai_keys where id = p_id;
  if v_nom is null then return false; end if;

  delete from vault.secrets where name = v_nom;
  delete from public.ai_keys where id = p_id;
  return true;
end;
$$;

-- Bu funksiyalar FAQAT edge funksiyalar uchun. Brauzerdan chaqirilsa
-- kalitlar oshkor bo'lardi.
revoke all on function public.ai_key_qoshish(text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.ai_key_olish(text)                     from public, anon, authenticated;
revoke all on function public.ai_key_ochirish(uuid)                  from public, anon, authenticated;

grant execute on function public.ai_key_qoshish(text, text, text, uuid) to service_role;
grant execute on function public.ai_key_olish(text)                     to service_role;
grant execute on function public.ai_key_ochirish(uuid)                  to service_role;
