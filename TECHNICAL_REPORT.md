# AGRO ALLIANCE — To'liq Texnik Hisobot

**Loyiha:** `allianse` — O'zbek tilidagi agro-media platforma (blogerlar, fermerlar, kompaniyalar, texnologiyalar)
**Tekshirilgan sana:** 2026-07-10
**Hisobot turi:** Read-only arxitektura tahlili

---

## 1. LOYIHA STRUKTURASI

### 1.1 Asosiy papkalar va ularning vazifasi

| Papka | Vazifa |
|---|---|
| `src/` | Frontend manba kodi (React/TypeScript) |
| `src/components/` | Qayta ishlatiladigan React komponentlari (Header, Footer, DashboardLayout, MediaUpload, Newsletter) |
| `src/pages/` | Sahifalar (Home, News, Bloggers, Partners, Contact, Login, va boshqalar) |
| `src/pages/dashboard/` | Dashboard sahifalari (AdminDashboard, BloggerDashboard, ClientDashboard) |
| `src/lib/` | Yordamchi kutubxonalar (API client, auth, UI primitivlari, turiblar) |
| `src/assets/` | Rasm va statik fayllar |
| `supabase/` | Backend: Edge Functions, migratsiyalar, navbatlar, workerlar |
| `supabase/functions/` | 147+ Supabase Edge Functions (API endpointlari) |
| `supabase/functions/_shared/` | Umumiy kutubxonalar (AI, provider, auth, cors, validation, va boshqalar) |
| `supabase/migrations/` | Ma'lumotlar bazasi migratsiyalari (schema, RLS, triggerlar) |
| `supabase/queues/` | Navbat tizimi (media, email, social, retry) |
| `supabase/workers/` | Worker tizimi (ai-news, analytics, cleanup, media, scheduler, social) |
| `public/` | Statik aktivlar (logo, mascot, favicon, hero-rasm) |
| `docs/` | 10 ta spetsifikatsiya hujjati + backend arxitektura hujjatlari |
| `.audit/` | Audit hisobotlari va SQL tekshiruvlari |

### 1.2 Eng muhim 15-20 fayl va ularning vazifasi

| # | Fayl yo'li | Vazifa |
|---|---|---|
| 1 | `src/App.tsx` | Asosiy routing — barcha sahifalar va ularning marshalari |
| 2 | `src/lib/api.ts` | Markaziy API client — token boshqaruvi, 147+ edge function URL'larini marshrutlash |
| 3 | `src/lib/auth.tsx` | Auth kontekst provayderi — Supabase auth holati + edge function token fallback |
| 4 | `src/lib/ui.tsx` | Barcha UI primitivlari: Skeleton, Reveal animatsiya, 60+ ikon, nav havolalar, logo yo'li |
| 5 | `src/lib/supabase.ts` | Supabase clientini ishga tushirish |
| 6 | `src/index.css` | Brend konfiguratsiyasi — ranglar, shriftlar, animatsiyalar (Tailwind @theme) |
| 7 | `src/pages/dashboard/AdminDashboard.tsx` | To'liq admin panel (~2027 qator): blogerlar, hamkorlar, yangiliklar, kategoriyalar, rollar, homepage, manbalar, foydalanuvchilar, xabarlar, obunachilar, statistika, sozlamalar |
| 8 | `src/pages/dashboard/BloggerDashboard.tsx` | Blogger o'z-o'ziga xizmat: profil, ijtimoiy tarmoqlar, videolar, rasmlar, xizmatlar, hududlar, ixtisosliklar, yutuqlar, brendlar |
| 9 | `supabase/functions/_shared/provider.ts` | AI provider framework: OpenAI, Anthropic, Gemini, Cloudflare + circuit-breaker, prioritet, failover |
| 10 | `supabase/functions/_shared/ai.ts` | AI orkestratsiya: validateContent, categorizeContent, translateContent, summarizeContent, generateSeo, isDuplicate |
| 11 | `supabase/functions/_shared/promptEngine.ts` | Versiyalangan prompt shablonlarini DB'dan yuklash va {{variable}} interpolatsiya |
| 12 | `supabase/functions/_shared/config.ts` | Konfiguratsiya yuklash: Supabase, R2, AI, YouTube, Telegram, OAuth, App |
| 13 | `supabase/functions/_shared/costTracker.ts` | LLM xarajatlarini yozish, kunlik/oylik byudjetni nazorat qilish |
| 14 | `supabase/functions/worker-ai-news-engine/index.ts` | RSS → AI tanlash → AI tarjima → nashr qilish (Groq Llama 3.3-70b) |
| 15 | `supabase/functions/worker-ai-validate/index.ts` | Maqola sifatini tekshirish (Gemini 2.0 Flash) |
| 16 | `supabase/functions/_shared/globalAgroFeeds.ts` | 16 ta global agro RSS manbalari + qidiruv mavzulari |
| 17 | `supabase/functions/_shared/embeddingEngine.ts` | Vektor embedding generatsiyasi, saqlash, kosinus o'xshashlik qidiruvi |
| 18 | `supabase/functions/_shared/retryEngine.ts` | Eksponensial backoff + circuit-breaker integratsiyasi |
| 19 | `supabase/functions/_shared/r2Client.ts` | Cloudflare R2 integratsiyasi (rasmlar, videolar saqlash) |
| 20 | `supabase/functions/_shared/socialQueue.ts` | Ijtimoiy tarmoq postlarini navbatga qo'shish mantiqi |

---

## 2. AI/LLM INTEGRATSIYASI

### 2.1 LLM Provider'larning konfiguratsiya joylashuvi

| Konfiguratsiya turi | Fayl yo'li | Tavsif |
|---|---|---|
| **Provider framework** | `supabase/functions/_shared/provider.ts` | Asosiy abstrakt sinf + 4 ta konkret provider (OpenAI, Anthropic, Gemini, Cloudflare) |
| **Provider ma'lumotlari bazasi** | `supabase/migrations/20240708000080_ai_providers.sql` | `ai_providers` va `ai_models` jadvallari — DB'dan yuklanadi |
| **Konfiguratsiya yuklash** | `supabase/functions/_shared/config.ts` | Env var'lardan AI_WORKER_URL, AI_WORKER_API_KEY |
| **Groq yordamchi** | `supabase/functions/_shared/groq.ts` | Mustaqil Groq helper (Llama 3.1-8b) |
| **Gemini yordamchi** | `supabase/functions/_shared/gemini.ts` | Mustaqil Gemini helper (Gemini 2.0 Flash) |
| **AI orkestratsiya** | `supabase/functions/_shared/ai.ts` | validate, categorize, translate, summarize, SEO, duplicate tekshirish |
| **Xarajat kuzatish** | `supabase/functions/_shared/costTracker.ts` | LLM xarajatlarini yozish + byudjet cheklovlari |
| **Embedding** | `supabase/functions/_shared/embeddingEngine.ts` | Vektor embedding + kosinus o'xshashlik |

### 2.2 Provider turlari va ularning API endpointlari

| Provider | API URL | Sinf nomi |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `OpenAIProvider` |
| Anthropic | `https://api.anthropic.com/v1` | `AnthropicProvider` |
| Gemini | `https://generativelanguage.googleapis.com/v1beta` | `GeminiProvider` |
| Cloudflare | `https://api.cloudflare.com/client/v4/accounts/{id}/ai` | `CloudflareProvider` |

### 2.3 Yangi OpenAI-compatible provider (masalan NVIDIA NIM) qo'shish

Bu loyihada provider qo'shish juda oson — arxitektura shunday qurilgan:

**Qadamlar:**

1. **`supabase/functions/_shared/provider.ts`** ga yangi sinf qo'shing:
   ```typescript
   export class NvidiaNimProvider extends BaseProvider {
     capabilities = new Set([ProviderCapability.CHAT]);
     private baseUrl = "https://integrate.api.nvidia.com/v1"; // NIM endpointi
     
     async invoke<T>(payload: LlmPayload): Promise<LlmResult<T>> {
       // OpenAI-compatible format: /chat/completions
       // Body: { model, messages, max_tokens, temperature }
       // Header: Authorization: Bearer {api_key}
       // Javob: choices[0].message.content
     }
   }
   ```

2. **`ProviderRegistry.loadProviders()`** ichidagi `switch` ga qo'shing:
   ```typescript
   case "nvidia_nim":
     return new NvidiaNimProvider(p as ProviderConfig, model);
   ```

3. **`ai_providers` jadvaliga yangi yozuv qo'shing:**
   ```sql
   INSERT INTO ai_providers (name, type, enabled, priority, secret_name, config)
   VALUES ('nvidia_nim', 'nvidia_nim', true, 3, 'NVIDIA_NIM_API_KEY', '{}');
   ```

4. **`ai_models` jadvaliga model qo'shing:**
   ```sql
   INSERT INTO ai_models (provider_id, model_name, max_tokens, temperature, enabled, cost_per_1k)
   VALUES ('<provider_id>', 'meta/llama-3.1-405b-instruct', 4096, 0.7, true, 0.001);
   ```

**Muhim:** Provider tipi `ProviderConfig.type` maydonida ro'yxatdan o'tgan bo'lishi kerak. Hozirgi tur ro'yxati: `"openai" | "anthropic" | "cloudflare" | "azure" | "gemini"`. Yangi tip qo'shish uchun `ProviderConfig` interfeysidagi type union'ini kengaytiring.

### 2.4 System prompt'lar qayerda joylashgan

**System prompt'lar DB'da saqlanadi**, hardcoded emas.

| Komponent | Fayl yo'li | Tavsif |
|---|---|---|
| **Prompt engine** | `supabase/functions/_shared/promptEngine.ts` | `ai_prompt_templates` jadvalidan yuklaydi, `{{variable}}` interpolatsiya qiladi |
| **Jadval sxemasi** | `supabase/migrations/20240708000080_ai_providers.sql` | `ai_prompt_templates` jadvali (purpose, version, template) |
| **Turlar** | `validation`, `categorisation`, `translation`, `summarisation`, `seo` |

**Ishlash tartibi:**
1. Worker `buildPrompt(purpose, variables)` chaqiradi
2. Engine DB'dan eng so'nggi versiyani yuklaydi
3. `{{variable}}` larni qiymatlar bilan almashtiradi
4. Tayyor promptni LLM'ga yuboradi

**Eksperimentlar:** `EXP_PROMPT_VALIDATION` kabi env var'lar orqali ma'lum versiyani sinash mumkin.

---

## 3. UI/UX QATLAMI

### 3.1 Chat interfeysi

**Chat interfeysi bu loyihada mavjud emas.** Bu kontent/media platforma, chat ilovasi emas.

Eng yaqin interaktiv elementlar:
- `src/components/Newsletter.tsx` — Email obuna formasi
- `src/pages/Contact.tsx` — Kontakt formasi sahifasi
- `src/pages/Login.tsx` — Auth kirish
- `src/pages/Register.tsx` — Auth ro'yxatdan o'tish

### 3.2 Fayl daraxti, terminal, kod muharriri komponentlari

**Bu komponentlar bu loyihada mavjud emas.** Bu media platforma, kod muharriri emas.

### 3.3 Komponentlarni shartli ravishda yashirish/ko'rsatish

Hozirgi loyihada bu funksiya mavjud emas. Lekin arxitektura imkon beradi:

**Mavjud arxitektura tahlili:**
- `src/App.tsx:44-50` — `RequireRole` komponenti mavjud, u rollarga qarab sahifalarni bloklaydi
- `src/lib/auth.tsx` — Auth konteksti user rolini saqlaydi
- `src/pages/dashboard/AdminDashboard.tsx` — Admin panel ichida tab-navigation orqali bo'limlar almashadi

**"Advanced Mode" toggle qo'shish mumkinmi?**
- **Ha**, oson. AdminDashboard ichida tab-navigation allaqachon mavjud. Toggle qo'shish uchun:
  1. `AdminDashboard.tsx` ga state qo'shing: `const [advancedMode, setAdvancedMode] = useState(false)`
  2. Toggle tugmani topbar'ga qo'shing
  3. Har bir bo'limni `advancedMode` ga bog'lang: `{advancedMode && <AdvancedSection />}`
  4. **Murakkablik: OSON** — allaqachon tab-navigation mavjud, faqat conditional rendering qo'shish kerak

---

## 4. SANDBOX/PREVIEW

### 4.1 WebContainer integratsiyasi

**WebContainer integratsiyasi bu loyihada mavjud emas.**

Yagona "preview" tushunchasi:
- `supabase/functions/_shared/previewGenerator.ts` — Maqola rasmlari uchun CDN thumbnail URL'larini generatsiya qiladi (WebContainer bilan bog'liq emas)
- `vite.config.ts` — `vite preview` skripti lokal build preview uchun

### 4.2 Preview oynasi

**Preview oynasi mavjud emas.** Bu kontent platforma — kod ishlatmaydi, faqat kontent ko'rsatadi.

---

## 5. DEPLOY MEXANIZMI

### 5.1 Netlify/Vercel integratsiyasi

**Netlify yoki Vercel integratsiyasi mavjud emas.**

Mavjud deploy konfiguratsiyalari:
- `netlify.toml` — **YO'Q**
- `vercel.json` — **YO'Q**
- `Dockerfile` — **YO'Q**
- `_redirects` — **YO'Q**
- CI/CD fayllari — **YO'Q**

### 5.2 Deploy jarayoni

Deploy butunlay **Supabase CLI** orqali bajariladi.

**Hujjat:** `docs/backend/deployment.md`

**Qadamlar:**

| # | Buyruq | Vazifa |
|---|---|---|
| 1 | `supabase link --project-ref <ref>` | Loyihani Supabase bilan bog'lash |
| 2 | `supabase db push` | Migratsiyalarni DB'ga yuborish |
| 3 | `supabase functions deploy` | Barcha Edge Functions'ni deploy qilish |
| 4 | Supabase cron | Rejalashtirilgan vazifalar (cron-news-ingest, cron-news-publish, cron-social-publish-scheduler) |

**Frontend deploy:** Vite build (`tsc -b && vite build`) → `dist/` papkasi → statik hosting (hozircha aniq manba ko'rsatilmagan, ehtimol Supabase Storage yoki tashqi CDN).

**Muhim:** Frontend deploy mexanizmi hujjatda aniq ko'rsatilmagan. `dist/` papkasi mavjud, lekin qayerga yuklanishi noma'lum.

---

## 6. MURAKKABLIK BAHOSI

### 6.1 Branding o'zgartirish (logo, ranglar, nom)

| O'zgartirish turi | Fayl yo'li | Murakkablik | Tavsif |
|---|---|---|---|
| **Logo o'zgartirish** | `public/logo.webp` + `public/favicon.svg` | **OSON** | Fayllarni almashtiring, boshqa hech narsa o'zgarmaydi |
| **Ranglarni o'zgartirish** | `src/index.css:3-15` (Tailwind @theme) | **OSON** | 6 ta CSS o'zgaruvchini tahrirlang: `--color-green`, `--color-green-deep`, `--color-green-dark`, `--color-leaf`, ``color-gold`, `--color-soft` |
| **Shriftlarni o'zgartirish** | `src/index.css:13-14` + `index.html:10-12` | **OSON** | 2 ta CSS o'zgaruvchi + Google Fonts import |
| **Nom o'zgartirish** | `src/lib/ui.tsx` (logo path) + `src/components/Header.tsx` + `src/components/Footer.tsx` + `supabase/functions/_shared/config.ts:79` | **O'RTA** | 4+ faylda nom mavjud |
| **Mascot o'zgartirish** | `public/mascot*.webp` (5 ta fayl) | **OSON** | Fayllarni almashtiring |
| **Hero fon rasmi** | `public/hero-bg.webp` | **OSON** | Bitta faylni almashtiring |

### 6.2 Har bir o'zgartirish uchun to'liq baholash

| O'zgartirish | Murakkablik | Ish vaqti | Izoh |
|---|---|---|---|
| Logo almashtirish | **OSON** | 5 daqiqa | Faqat `public/logo.webp` va `public/favicon.svg` |
| Rang sxemasini o'zgartirish | **OSON** | 10 daqiqa | `src/index.css:3-15` — 6 ta qiymat |
| Shriftni o'zgartirish | **OSON** | 15 daqiqa | CSS + Google Fonts import |
| Nomni o'zgartirish | **O'RTA** | 30 daqiqa | 4+ faylda search & replace |
| Yangi sahifa qo'shish | **O'RTA** | 1-2 soat | Yangi fayl + App.tsx routing + nav qo'shish |
| Yangi API endpoint | **O'RTA** | 1-2 soat | Yangi Edge Function + api.ts routing + frontend chaqiruv |
| Yangi AI provider | **O'RTA** | 1 soat | provider.ts sinf + DB yozuv + switch case |
| Yangi rol qo'shish | **QIYIN** | 2-4 soat | Migratsiya + RLS + auth + frontend routing + dashboard |
| Ijtimoiy tarmoq integratsiyasi | **QIYIN** | 3-6 soat | Worker + API kalit + navbat + rate limit |
| To'liq qayta brending | **QIYIN** | 4-8 soat | Barcha CSS + fayllar + nom + hujjatlar |

---

## 7. TEXNIK XULOSA

### 7.1 Kuchli tomonlar
- **Yaxshi arxitektura:** Provider pattern, circuit-breaker, cost tracking — production-ga tayyor
- **DB-stored prompts:** Prompt'lar versiyalangan va tajriba qilishga tayyor
- **AI pipeline:** To'liq avtomatlashtirilgan RSS → AI → nashr → ijtimoiy tarmoq
- **Rollar tizimi:** RBAC to'liq amalga oshirilgan (super_admin, blogger, company)
- **147+ API endpoint:** Barcha kerakli funksiyalar mavjud

### 7.2 Kamchiliklar va xavflar
- **Frontend deploy mexanizmi noma'lum:** `dist/` papkasi mavjud, lekin qayerga yuklanishi ko'rsatilmagan
- **Chat interfeysi yo'q:** Agar foydalanuvchi bilan muloqot kerak bo'lsa, qo'shish kerak
- **WebContainer yo'q:** Kod preview/sandbox funksiyasi mavjud emas
- **CI/CD yo'q:** Avtomatik test va deploy truboprovodi mavjud emas
- **Docker yo'q:** Konteynerizatsiya qilinmagan

### 7.3 Yangi provider qo'shish (NVIDIA NIM misoli)
1. `supabase/functions/_shared/provider.ts` ga sinf qo'shing
2. `ProviderConfig.type` union'ini kengaytiring
3. `ProviderRegistry.loadProviders()` ga case qo'shing
4. DB'ga yozuv qo'shing (`ai_providers` + `ai_models`)
5. API kalitini env var'ga qo'shing

**Taxminiy vaqt:** 1-2 soat

---

*Hisobot tayyor. Savol bo'lsa, bemalol so'rang.*
