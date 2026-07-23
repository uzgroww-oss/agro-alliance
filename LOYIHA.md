# Agro Alliance — Loyiha qo'llanmasi

> O'zbekistondagi agro blogerlarni brendlar bilan bog'lovchi marketing platformasi.
> Ushbu hujjat yangi dasturchi loyihani noldan tushunib, ishga tushirishi va davom ettirishi uchun yozilgan.

**Sayt:** agroalliance.uz · **Hosting:** Netlify · Android va iOS ilovalari bor.

---

## Mundarija

1. [Loyiha nima](#1-loyiha-nima)
2. [Texnologiyalar](#2-texnologiyalar)
3. [Kod tuzilishi](#3-kod-tuzilishi)
4. [Rollar va sahifalar](#4-rollar-va-sahifalar)
5. [Asosiy funksiyalar](#5-asosiy-funksiyalar)
6. [Ma'lumot oqimi](#6-malumot-oqimi-muhim-mantiq)
7. [Ishga tushirish](#7-ishga-tushirish-lokal)
8. [Deploy qilish](#8-deploy-qilish)
9. [Maxfiy kalitlar](#9-maxfiy-kalitlar)
10. [Bilib qo'yish kerak](#10-bilib-qoyish-kerak)

---

## 1. Loyiha nima

**Bir jumlada:** agentlik blogerlarni oylikka yollaydi va ularning auditoriyasini brendlarga reklama sifatida sotadi.

### Biznes model

Agentlik **70–80 ta agro blogerni** oylik shartnoma bilan ishlatadi. Kompaniyalarga (brendlarga) yiliga taxminan **$120 000** lik reklama paketlari sotiladi. Har bir kompaniyaga alohida **login/parol** beriladi — ular kabinetga kirib blogerlarni, ularning statistikasini ko'radi va hamkorlik qiladi.

Platformada uch tomon bor:
- **Agentlik** (admin) — hammani boshqaradi
- **Blogerlar** — kontent egalari
- **Kompaniyalar** — reklama beruvchilar

### Hozirgi holat

| Ko'rsatkich | Qiymat |
|---|---|
| Real bloger | 34 |
| Umumiy auditoriya | 8.6M+ |
| Oylik ko'rishlar | 57.9M+ |
| Viloyat | 12 |

---

## 2. Texnologiyalar

Frontend to'liq React, backend to'liq Supabase — alohida server yo'q.

### Frontend
- **React 19** + **Vite 8** + **TypeScript**
- **Tailwind CSS v4** — konfiguratsiya faylsiz, CSS ichida `@theme`
- **React Router** — sahifalar
- **Recharts** — grafiklar
- **DOMPurify** — yangilik HTML tozalash

### Backend — Supabase
- **Postgres** + RLS (qatorli xavfsizlik)
- **165 ta Deno edge funksiya** (butun API)
- **Auth** — kirish/rollar
- **Storage** — rasm/fayl yuklash
- **pg_cron** — rejalashtirilgan vazifalar

### Hosting va build
- **Netlify** — web sayt (SPA)
- **Capacitor 8** — Android + iOS ilova
- **GitHub Actions** — bepul Android APK build
- **Codemagic** — iOS + Android build

### Supabase loyihasi
- Project ID: `ckdgprxppmtsgrofvkxd`
- Nomi: `uzgroww` · Region: Singapur (ap-southeast-1)
- CLI orqali allaqachon ulangan (`supabase link` qilingan)

---

## 3. Kod tuzilishi

Ikkita asosiy papka: `src/` (frontend) va `supabase/` (backend).

```
allianse11/
├─ src/
│  ├─ pages/            # barcha sahifalar (Home, Bloggers, Contact...)
│  │  └─ dashboard/     # AdminDashboard, BloggerDashboard, PartnerDashboard
│  ├─ components/       # Header, Footer, DashboardLayout, MediaUpload
│  ├─ lib/              # mantiq — pastda batafsil
│  └─ App.tsx           # marshrutlar shu yerda
├─ supabase/
│  ├─ functions/        # 165 ta edge funksiya (API)
│  │  └─ _shared/       # umumiy: auth, cors, email, validation...
│  └─ migrations/       # 31 ta SQL migratsiya (baza tuzilishi)
├─ scripts/
│  └─ generate-seo.mjs  # build'dan keyin SEO HTML yaratadi
├─ android/  ios/       # Capacitor mobil loyihalar
└─ netlify.toml         # hosting sozlamalari
```

### `src/lib/` — eng muhim mantiq shu yerda

| Fayl | Vazifasi |
|---|---|
| `api.ts` | Frontend yo'lini (`/partners/:id`) edge funksiya nomiga aylantiradi. **Yangi API qo'shsangiz shu yerni ham yangilang.** |
| `auth.tsx` | Kirish holati, foydalanuvchi, `useAuth()` hook |
| `roles.ts` / `role-map.ts` | Rollarni aniqlash, kim qaysi kabinetga kiradi |
| `supabase.ts` | Supabase klient |
| `seo.ts` + `seo-data.json` | Sahifa meta teglari (title, description). Sarlavhalar shu JSON'da. |
| `settings.ts` | Sayt sozlamalari + `useContactInfo()` (footer va aloqa uchun umumiy) |
| `ui.tsx` | Umumiy komponentlar: Skeleton, StatsBar, `useBusy()`, ErrorState, ikonkalar |
| `bloggers.ts` / `news.ts` / `sections.ts` | Ma'lumot yuklovchi yordamchilar |

---

## 4. Rollar va sahifalar

5 ta rol bor. Kirgandan keyin har kim o'z kabinetiga yo'naltiriladi (`roleHome()`).

### Rollar

| Rol | Kim | Kabinet |
|---|---|---|
| `super_admin` | Agentlik egasi | `/admin` |
| `admin` | Administrator | `/admin` |
| `editor` | Kontent muharriri | `/admin` (cheklangan) |
| `blogger` | Bloger | `/dashboard` |
| `company` | Reklama beruvchi kompaniya | `/hamkor` |

> **Muhim:** hisoblar faqat **admin tomonidan** yaratiladi. O'z-o'zidan ro'yxatdan o'tish yo'q — email tasdiqlash ham shart emas.

### Marshrutlar (`src/App.tsx`)

- **Ommaviy:** `/` · `/about` · `/blogerlar` · `/blogerlar/:slug` · `/yangiliklar` · `/yangiliklar/:slug` · `/hamkorlar` · `/aloqa` · `/platforma` · `/shartlar` · `/maxfiylik`
- **Kirish:** `/kirish` · `/reset-password`
- **Kabinetlar (himoyalangan):** `/admin` · `/dashboard` · `/hamkor`

---

## 5. Asosiy funksiyalar

### 🛠 Admin panel (`/admin`)
- **Blogerlar** — qo'shish, tahrirlash, o'chirish, holat
- **Hamkorlar** — kompaniya + login yaratish, logo yuklash
- **Topshiriqlar (TZ)** — blogerlarga vazifa yuborish (fayl bilan)
- Yangiliklar, kategoriyalar, foydalanuvchilar, rollar
- Bosh sahifa matnlari, sozlamalar, monitoring

### 📹 Bloger kabineti (`/dashboard`)
- Profil, avatar (YouTube/Instagram'dan avtomatik)
- Ijtimoiy tarmoqlar, videolar
- Xizmatlar, hududlar, mutaxassisliklar
- Yutuqlar, brendlar, rasmlar galereyasi
- **Topshiriqlar** — admin yuborganlarini ko'radi

### 🏢 Kompaniya kabineti (`/hamkor`)
- Barcha blogerlarni ko'rib chiqish
- Shartnoma ma'lumotlari
- Bildirishnomalar

### 🌐 Ommaviy sayt
- Bloger katalogi + qidiruv (Instagram username bilan ham)
- Bloger profillari (statistika, grafiklar)
- Yangiliklar, hamkorlar
- **Aloqa formasi** → email + bazaga saqlash

---

## 6. Ma'lumot oqimi (muhim mantiq)

Statistika qanday yig'iladi — bu loyihaning eng nozik qismi.

### Oylik ko'rishlar (eng murakkab)

Ikki manbadan yig'iladi va har oy avtomatik yangilanadi:

- **YouTube** — snapshot ayirmasi. Har oy kanalning umrbod jami ko'rishi `youtube_view_snapshots` jadvaliga yoziladi. Oylik ko'rish = `(shu oy jami) − (o'tgan oy jami)`. Bu eski videolar ko'rishini ham qamrab oladi.
- **Instagram** — `business_discovery` API orqali o'tgan oyda joylangan reels'lar ko'rishi.

> **Diqqat:** YouTube snapshot usuli ayirma uchun **ikki oylik ma'lumot** talab qiladi — birinchi to'g'ri raqam bazaviy yozuvdan keyingi oyda chiqadi.

### Rejalashtirilgan vazifalar (pg_cron)

| Vazifa | Vaqt | Nima qiladi |
|---|---|---|
| `agro-monthly-views` | Har oy 1-sana, 02:00 | Oylik ko'rishlarni hisoblaydi (`cron-monthly-views`) |
| `agro-ig-token-refresh` | Har yakshanba, 03:00 | Instagram tokenini yangilaydi (tugab qolmasin) |

Cron'lar `CRON_SECRET` bilan himoyalangan — tashqaridan chaqirib bo'lmaydi.

### Aloqa formasi → email

Aloqa formasi to'ldirilganda:
1. Avval bazaga yoziladi (admin panelda ko'rinadi)
2. Keyin **Resend** orqali `uzgrrow@gmail.com` ga email ketadi

Email ishlamasa ham xabar yo'qolmaydi.

---

## 7. Ishga tushirish (lokal)

Uch qadam. Node.js 22 kerak.

```bash
# 1. Paketlarni o'rnatish
npm install

# 2. .env fayl yaratish (loyiha ildizida)
#    VITE_SUPABASE_URL=https://ckdgprxppmtsgrofvkxd.supabase.co
#    VITE_SUPABASE_ANON_KEY=<anon kalit>
#    SUPABASE_SERVICE_ROLE_KEY=<service kalit>

# 3. Dev server
npm run dev        # → http://localhost:5173
```

### Foydali buyruqlar

| Buyruq | Vazifa |
|---|---|
| `npm run dev` | Dev server (jonli qayta yuklash) |
| `npm run build` | Ishlab chiqarish build + SEO HTML yaratish |
| `npm run lint` | ESLint tekshiruvi |
| `npx tsc -b` | TypeScript tip tekshiruvi |
| `supabase functions deploy <nom>` | Bitta edge funksiyani deploy qilish |

---

## 8. Deploy qilish

Web avtomatik, backend qo'lda, mobil CI orqali.

### 🌐 Web (Netlify)

`git push origin main` — Netlify avtomatik build qiladi. `npm run build` ishga tushadi, keyin `postbuild` SEO HTML'larini yaratadi.

**Netlify env kerak:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### ⚙️ Backend (edge funksiya)

Kod o'zgargan funksiyani alohida deploy qilasiz:

```bash
supabase functions deploy admin-partners-update
```

### 📱 Android

**GitHub Actions** bepul APK yig'adi (`.github/workflows/android.yml`). `versionCode` har build'da avtomatik oshadi. JDK 21 kerak (Capacitor 8 talabi).

### 🍎 iOS

**Codemagic** orqali (`codemagic.yaml`) — Mac shart emas. Faqat **Apple Developer** hisobi kerak ($99/yil).

---

## 9. Maxfiy kalitlar

Supabase → Edge Functions → Secrets bo'limida saqlanadi. Kodda emas.

| Kalit | Nima uchun |
|---|---|
| `RESEND_API_KEY` | Aloqa formasi emaili |
| `CONTACT_TO_EMAIL` | Xabarlar keladigan manzil (`uzgrrow@gmail.com`) |
| `CRON_SECRET` | Cron vazifalarini himoyalash |
| `YOUTUBE_API_KEY` | YouTube statistikasi |
| `FACEBOOK_APP_ID` / `_SECRET` | Instagram OAuth |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram business_discovery |
| `TELEGRAM_BOT_TOKEN` | Telegram bildirishnomalari |

> ⚠️ **Xavfsizlik:** `SUPABASE_SERVICE_ROLE_KEY` RLS'ni chetlab o'tadi — uni hech qachon frontend'ga yoki gitga qo'ymang. Faqat edge funksiyalarda ishlatiladi.

### Lokal `.env` (git'ga qo'shilmaydi)

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## 10. Bilib qo'yish kerak

### O'ziga xosliklar

- **Service-role RLS'ni chetlab o'tadi** — haqiqiy ruxsat tekshiruvi edge funksiyalar ichidagi `requireRole()` da (`_shared/auth.ts`), bazadagi RLS'da emas.
- **SPA + statik SEO** — sayt client-rendered, lekin build'da har sahifa uchun alohida HTML yaraladi (bot'lar to'g'ri meta ko'rishi uchun). `scripts/generate-seo.mjs` shu ishni qiladi.
- **Til:** hamma narsa o'zbekcha. Tarjima (i18n) tizimi yo'q.
- **ESLint 40 ta ogohlantirish** beradi — bu loyihaning umumiy uslubi (`useEffect` ichida fetch). Build'ga xalaqit bermaydi.

### Hali qilinmagan / yaxshilanishi mumkin

- **SEO:** 28 ta rasmda `alt=""` bo'sh; JS bundle 1.1MB (code-splitting kerak).
- **Kompaniya ↔ bloger kampaniya bog'lanishi** — biznesning asosiy bo'g'ini, hali qurilmagan.
- **Oylik ko'rishlar** — YouTube snapshot to'liq to'g'ri raqamni bazaviy yozuvdan keyingi oydan beradi.

> **Yordam:** savol tug'ilsa — kod izohlar bilan yozilgan (ayniqsa `_shared/` va cron funksiyalarda "MUHIM" deb boshlangan izohlar nima uchun shundayligini tushuntiradi).

---

*Agro Alliance · Ichki developer hujjati · React 19 + Supabase + Capacitor*
