-- ============================================================================
-- AI NATIJALARI KESHI
-- ============================================================================
-- MUAMMO: bir xil matn qayta-qayta AI ga yuboriladi. Tarjima versiyasi
-- o'zgargan sari BUTUN kontent qaytadan tarjima qilinardi — matn
-- o'zgarmagan bo'lsa ham. Bitta to'ldirishda 13 ta blok uchun yuzlab
-- chaqiruv ketdi, kvota esa shundan tugadi.
--
-- YECHIM: natija MATN XESHI bo'yicha saqlanadi. Matn o'zgarmagan bo'lsa
-- javob keshdan olinadi — AI umuman chaqirilmaydi.
--
-- Kesh vazifa turi bo'yicha ajratilgan (`vazifa`): tarjima, izoh
-- tahlili va boshqalar bir-birining natijasini olmasin.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_cache (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Vazifa turi: "translate:ru", "comment-analysis" va h.k.
  vazifa     text NOT NULL,
  -- Kirish matnining SHA-256 xeshi (16 lik ko'rinishda)
  xesh       text NOT NULL,
  natija     jsonb NOT NULL,
  -- Qaysi model javob bergani — sifat muammosini izlashda kerak
  model      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Oxirgi marta qachon ishlatilgani: eskirganini tozalash uchun
  used_at    timestamptz NOT NULL DEFAULT now(),
  hits       integer NOT NULL DEFAULT 0
);

-- Bitta vazifa + xesh juftligi yagona bo'lsin
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_cache_vazifa_xesh
  ON public.ai_cache (vazifa, xesh);

CREATE INDEX IF NOT EXISTS idx_ai_cache_used
  ON public.ai_cache (used_at);

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;
-- Siyosat ataylab yo'q: faqat service_role (edge funksiyalar) kiradi.

-- ============================================================================
-- AI SARFI HISOBI
-- ============================================================================
-- Qaysi provayder qancha chaqirilgani, nechtasi muvaffaqiyatli, qancha
-- token ketgani. Bu ma'lumotsiz "AI qancha pul yeyapti?" degan savolga
-- javob yo'q edi — `ai_costs` jadvali bor edi, lekin unga hech kim
-- yozmasdi.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provayder   text NOT NULL,              -- gemini | groq | cloudflare
  vazifa      text NOT NULL,              -- translate | comment-analysis | smm ...
  muvaffaqiyat boolean NOT NULL,
  -- Taxminiy token soni: aniq hisob provayderga bog'liq, hammasi ham
  -- bermaydi. Yo'q bo'lsa matn uzunligidan chamalanadi.
  tokenlar    integer,
  davomiylik  integer,                    -- millisekund
  xato        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_vaqt ON public.ai_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provayder ON public.ai_usage (provayder, created_at DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
