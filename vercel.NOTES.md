# `vercel.json` — nega shunday sozlangan

**Bu izohlarni `vercel.json` ichiga QAYTARMANG.**

JSON da izoh yo'q. Ilgari ular `"//"` kaliti bilan yozilgan edi va
Vercel deploy paytida rad etdi:

```
Invalid request: `headers[0]` should NOT have additional property `//`.
Please remove it.
```

Vercel `vercel.json` ni qat'iy sxema bo'yicha tekshiradi: sxemada yo'q
har qanday maydon — xato. Shuning uchun izohlar shu faylga ko'chirildi.

---

## `/(.*)` — xavfsizlik sarlavhalari

Hamma javobga qo'shiladi:

| Sarlavha | Nima uchun |
|---|---|
| `X-Content-Type-Options: nosniff` | Brauzer MIME turini "taxmin qilmasin" — yuklangan fayl skript sifatida bajarilib ketmasin |
| `X-Frame-Options: DENY` | Saytni begona sahifa iframe'iga qo'yib bo'lmaydi (clickjacking). **Bu yerda bo'lishi SHART**: CSP `frame-ancestors` orqali ham shu ishni qiladi, lekin bizning CSP `<meta>` bilan beriladi va `frame-ancestors` meta'da ishlamaydi |
| `Referrer-Policy: strict-origin-when-cross-origin` | Begona saytga o'tilganda to'liq manzil ketmasin — kabinet havolalarida id lar bo'ladi |
| `Permissions-Policy` | Kamera, mikrofon, joylashuv, to'lov, USB — sayt bularni umuman so'ramaydi |
| `Strict-Transport-Security` | Bir yil davomida faqat HTTPS, subdomenlar bilan |

**Content-Security-Policy bu yerda YO'Q** va ataylab shunday.

CSP ichida `index.html` dagi inline skriptning sha256 hash'i bo'lishi
kerak, u esa har build'da o'zgaradi (skript ichidagi `%VITE_SUPABASE_URL%`
kabi o'rinbosarlar build paytida almashadi). `vercel.json` repodan
o'qiladi, ya'ni build natijasini bilmaydi — hash'ni bu yerga yozib
qo'yib bo'lmaydi.

Shuning uchun CSP `scripts/generate-seo.mjs` da hisoblanadi va har bir
HTML ichiga `<meta http-equiv="Content-Security-Policy">` sifatida
qo'yiladi. Hash har doim o'sha HTML ga mos keladi.

⚠️ `index.html` dagi inline skriptga `onload=` kabi inline hodisa
ishlovchisi QO'SHMANG — CSP uni bloklaydi (hash faqat `<script>`
teglariga tegishli).

## `/assets/(.*)` — bir yillik `immutable` kesh

Vite qurgan fayllar nomida mazmun xeshi bor (`index-De0oDcMi.js`).
Mazmuni o'zgarsa NOMI ham o'zgaradi, ya'ni eski nomdagi fayl hech
qachon boshqa mazmunga ega bo'lmaydi — uni abadiy keshlash xavfsiz.

Ilgari bu yerda `max-age=0, must-revalidate` turardi va brauzer HAR
sahifa ochilishida serverdan so'rab, `304 Not Modified` olardi.
O'lchandi: har fayl uchun alohida ~0.48 s bekorga ketardi
(Toshkentdan ko'proq).

## Rasm va shriftlar — bir yillik `immutable` kesh

⚠️ **QOIDA: rasmni o'zgartirsangiz FAYL NOMINI ham o'zgartiring.**
(masalan `logo.webp` → `logo-v2.webp`)

Bu fayllar nomi mazmun bilan bog'lanmagan, ya'ni `logo.webp` ichi
o'zgarsa ham nomi o'sha qoladi. `immutable` esa brauzerga "bu fayl
hech qachon o'zgarmaydi" deydi — nomi o'zgarmasa foydalanuvchi bir
yilgacha eski rasmni ko'rib yuraveradi.

Ilgari bu yerda bir kunlik kesh turardi. PageSpeed uni kamchilik deb
ko'rsatdi: har kuni 98 KB rasm qaytadan yuklanardi, holbuki ular
yillar davomida o'zgarmaydi.

## `/` — HECH QACHON keshlanmaydi

`index.html` da qurilgan asset fayllarining ANIQ nomlari yozilgan.
Agar u keshlansa, yangi deploydan keyin foydalanuvchi eski HTML oladi,
undagi nomlar esa endi mavjud emas — sayt oq ekran bo'lib qoladi.

Shuning uchun HTML har doim serverdan so'raladi, asset lar esa
keshdan olinadi. Bu ikkalasi birga ishlaydi: HTML kichik (bir necha
KB), asset lar esa katta va ular qayta yuklanmaydi.
