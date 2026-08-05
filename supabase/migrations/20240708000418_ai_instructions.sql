-- ============================================================================
-- AI GA QO'SHIMCHA KO'RSATMA
-- ============================================================================
-- MUAMMO: AI ga beriladigan ko'rsatmalar kod ichida yozilgan. "Har postda
-- Telegram botimizni eslatib o't" yoki "siyosat haqida yozma" degan oddiy
-- talab uchun ham dasturchi kerak va qayta deploy kerak edi.
--
-- YECHIM: har vazifa uchun QO'SHIMCHA ko'rsatma paneldan yoziladi va
-- kodagi ko'rsatmaning OXIRIGA qo'shiladi.
--
-- NEGA ALMASHTIRISH EMAS, QO'SHISH: asosiy ko'rsatmada javob shakli
-- (JSON maydonlari) belgilangan. Uni paneldan tahrirlash mumkin bo'lsa,
-- bitta noto'g'ri o'zgartirish butun AI ni ishdan chiqarardi va sababi
-- ko'rinmasdi. Qo'shimcha esa eng yomon holatda natijani biroz
-- o'zgartiradi, xolos.
--
-- Mavjud `ai_prompt_templates` jadvali ishlatilmadi: u `ai_providers`
-- ga majburiy FK talab qiladi, o'sha jadval esa bo'sh va ishlatilmaydi.
-- ============================================================================

create table if not exists public.ai_qoshimcha (
  -- Vazifa kaliti: generate | analyze | market | describe | chat | cover ...
  vazifa      text primary key,
  matn        text not null default '',
  faol        boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.ai_qoshimcha enable row level security;
-- Siyosat ataylab yo'q: faqat service_role (edge funksiya) kiradi.
