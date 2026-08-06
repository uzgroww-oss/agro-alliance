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

## `/assets/(.*)` — bir yillik `immutable` kesh

Vite qurgan fayllar nomida mazmun xeshi bor (`index-De0oDcMi.js`).
Mazmuni o'zgarsa NOMI ham o'zgaradi, ya'ni eski nomdagi fayl hech
qachon boshqa mazmunga ega bo'lmaydi — uni abadiy keshlash xavfsiz.

Ilgari bu yerda `max-age=0, must-revalidate` turardi va brauzer HAR
sahifa ochilishida serverdan so'rab, `304 Not Modified` olardi.
O'lchandi: har fayl uchun alohida ~0.48 s bekorga ketardi
(Toshkentdan ko'proq).

## Rasm va shriftlar — bir kunlik kesh + fon yangilash

Bu fayllar nomi mazmun bilan bog'lanmagan: `logo.webp` o'zgarsa ham
nomi o'sha bo'lib qoladi. Shuning uchun `immutable` EMAS.

`stale-while-revalidate=604800` — brauzer eski nusxani darhol
ko'rsatadi va yangisini fonda oladi. Foydalanuvchi kutmaydi, rasm esa
bir haftada yangilanadi.

## `/` — HECH QACHON keshlanmaydi

`index.html` da qurilgan asset fayllarining ANIQ nomlari yozilgan.
Agar u keshlansa, yangi deploydan keyin foydalanuvchi eski HTML oladi,
undagi nomlar esa endi mavjud emas — sayt oq ekran bo'lib qoladi.

Shuning uchun HTML har doim serverdan so'raladi, asset lar esa
keshdan olinadi. Bu ikkalasi birga ishlaydi: HTML kichik (bir necha
KB), asset lar esa katta va ular qayta yuklanmaydi.
