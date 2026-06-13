import { I } from "./ui"

export type News = {
  slug: string
  title: string
  cat: string
  desc: string
  date: string
  views: string
  seed: string
  top?: boolean
  author?: string
  body: string[]
}

export const cats = [
  { key: "all", label: "Barcha yangiliklar", icon: I.grid, count: 128 },
  { key: "texnologiya", label: "Agro texnologiya", icon: I.cpu, count: 24 },
  { key: "qishloq", label: "Qishloq xo'jaligi", icon: I.sprout, count: 32 },
  { key: "bozor", label: "Bozor va iqtisodiyot", icon: I.chart, count: 18 },
  { key: "davlat", label: "Davlat dasturlari", icon: I.doc, count: 12 },
  { key: "innovatsiya", label: "Innovatsiya", icon: I.bolt, count: 16 },
  { key: "ekologiya", label: "Ekologiya", icon: I.leaf, count: 10 },
  { key: "tadqiqotlar", label: "Tadqiqotlar", icon: I.flask, count: 8 },
  { key: "xalqaro", label: "Xalqaro yangiliklar", icon: I.globe, count: 8 },
]
export const catLabel = (k: string) => cats.find((c) => c.key === k)?.label ?? k

const gen = (lead: string) => [
  lead,
  "Mutaxassislarning fikricha, ushbu yo'nalishdagi rivojlanish qishloq xo'jaligi samaradorligini sezilarli oshiradi va fermerlarning daromadini ko'paytiradi. So'nggi yillarda sohaga zamonaviy texnologiyalar va innovatsion yechimlar tobora keng joriy etilmoqda.",
  "Loyiha doirasida mahalliy mutaxassislar va xalqaro hamkorlar birgalikda ish olib bormoqda. Bu nafaqat hosildorlikni oshiradi, balki resurslarni tejash va ekologik muvozanatni saqlashga ham xizmat qiladi.",
  "Agro Alliance platformasi ushbu yangilik va imkoniyatlarni fermerlar, bloglerlar va kompaniyalarga yetkazib, sohani raqamlashtirishga o'z hissasini qo'shmoqda. Kelgusida bu yo'nalishda yanada kengroq qamrovli dasturlar amalga oshirilishi rejalashtirilgan.",
]

export const news: News[] = [
  { slug: "dronlar-ekin-kuzatish", title: "Dronlar yordamida ekinlarni kuzatish yangi bosqichga chiqmoqda", cat: "texnologiya", desc: "Dron texnologiyalari dehqonlarga ekin holatini real vaqt rejimida kuzatish va hosildorlikni oshirishda yordam bermoqda.", date: "22 May, 2024", views: "14.2K", seed: "news-dron", top: true, author: "Agro Alliance", body: gen("Zamonaviy dron texnologiyalari qishloq xo'jaligida inqilob yasamoqda. Dronlar yordamida fermerlar ekin maydonlarini yuqoridan kuzatib, kasallik, zararkunanda yoki suv yetishmovchiligini erta aniqlay oladi.") },
  { slug: "tomchilatib-sugorish", title: "Tomchilatib sug'orish tizimlarining yangi avlodi joriy etilmoqda", cat: "qishloq", desc: "Suv tejovchi zamonaviy sug'orish tizimlari hosildorlikni oshirib, xarajatlarni kamaytirmoqda.", date: "21 May, 2024", views: "8.6K", seed: "news-sugorish", author: "Agro Alliance", body: gen("Tomchilatib sug'orishning yangi avlod tizimlari suvni 40% gacha tejash imkonini bermoqda. Sensorlar va avtomatlashtirish orqali har bir o'simlik aniq miqdorda suv oladi.") },
  { slug: "bioogit-loyihalari", title: "O'zbekistonda bioo'g'it ishlab chiqarish loyihalari kengaymoqda", cat: "innovatsiya", desc: "Ekologik toza bioo'g'itlar mahalliy ishlab chiqarish quvvatlari sezilarli oshmoqda.", date: "19 May, 2024", views: "6.3K", seed: "news-bioogit", author: "Agro Alliance", body: gen("Bioo'g'itlar tuproq unumdorligini tabiiy yo'l bilan oshiradi va kimyoviy o'g'itlarga bo'lgan ehtiyojni kamaytiradi. Mahalliy ishlab chiqaruvchilar quvvatini oshirmoqda.") },
  { slug: "don-narxlari-2024", title: "2024-yil hosil mavsumida don narxlari qanday bo'ladi?", cat: "bozor", desc: "Mutaxassislar don bozorida barqarorlik saqlanishini prognoz qilmoqda.", date: "18 May, 2024", views: "5.7K", seed: "news-don", author: "Agro Alliance", body: gen("2024-yil hosil mavsumi yaqinlashar ekan, don bozoridagi narxlar fermerlar va iste'molchilarni bir xilda qiziqtirmoqda. Tahlilchilar barqaror narxlarni bashorat qilmoqda.") },
  { slug: "imtiyozli-kreditlar", title: "Yangi davlat dasturi doirasida fermerlarga imtiyozli kreditlar beriladi", cat: "davlat", desc: "Dastur doirasida 2 trln so'mdan ortiq mablag' ajratilishi rejalashtirilgan.", date: "17 May, 2024", views: "4.9K", seed: "news-kredit", author: "Agro Alliance", body: gen("Yangi davlat dasturi fermerlarga past foizli kreditlar va subsidiyalar taqdim etadi. Bu mablag'lar zamonaviy texnika sotib olish va ishlab chiqarishni kengaytirishga sarflanadi.") },
  { slug: "avtomatik-traktorlar", title: "Avtomatlashtirilgan traktorlar: kelajak bugundan boshlanadi", cat: "texnologiya", desc: "Yangi avlod traktorlar yonilg'i tejamkor va yuqori samaradorlikka ega.", date: "16 May, 2024", views: "4.1K", seed: "news-traktor", author: "Agro Alliance", body: gen("Avtomatlashtirilgan, GPS bilan boshqariladigan traktorlar dala ishlarini aniqlik va tezlik bilan bajaradi. Bu yonilg'i sarfini kamaytiradi va inson omilini minimallashtiradi.") },
  { slug: "agrar-eksport-oshmoqda", title: "O'zbekiston agrar mahsulotlari eksporti hajmi oshmoqda", cat: "xalqaro", desc: "2024-yilning birinchi choragida eksport hajmi 17% ga oshdi.", date: "15 May, 2024", views: "3.8K", seed: "news-eksport", author: "Agro Alliance", body: gen("O'zbekiston agrar mahsulotlari xalqaro bozorlarda tobora ko'proq talab qilinmoqda. Meva-sabzavot eksporti yangi mamlakatlarga kengaymoqda.") },
  { slug: "quyosh-energiyasi-loyiha", title: "Qishloq xo'jaligida quyosh energiyasi ishlatish bo'yicha loyiha ishga tushdi", cat: "ekologiya", desc: "Loyiha doirasida 10 ta viloyatda sinov ishlari boshlandi.", date: "14 May, 2024", views: "3.2K", seed: "news-quyosh", author: "Agro Alliance", body: gen("Quyosh panellari sug'orish nasoslari va issiqxonalarni elektr energiyasi bilan ta'minlamoqda. Bu xarajatlarni kamaytiradi va atrof-muhitga zarar yetkazmaydi.") },
  { slug: "tuzga-chidamli-bugdoy", title: "Mahalliy olimlar tuzga chidamli bug'doy navi yaratdi", cat: "tadqiqotlar", desc: "Yangi nav sho'rlangan yerlarda yuqori hosil berishi bilan ajralib turadi.", date: "13 May, 2024", views: "2.7K", seed: "news-bugdoy", author: "Agro Alliance", body: gen("Mahalliy selektsionerlar tuzga chidamli yangi bug'doy navini yaratishga muvaffaq bo'lishdi. Bu nav sho'rlangan yerlarda ham barqaror hosil beradi.") },
]

export const popular = [
  { title: "O'zbekistonda tomchilatib sug'orish tizimlari kengaytirilmoqda", date: "20 May, 2024", views: "12.4K", seed: "pop-1", slug: "tomchilatib-sugorish" },
  { title: "Agro sohada sun'iy intellekt yechimlari", date: "18 May, 2024", views: "9.8K", seed: "pop-2", slug: "bioogit-loyihalari" },
  { title: "2024-yilda paxta hosildorligi oshishi kutilmoqda", date: "15 May, 2024", views: "8.7K", seed: "pop-3", slug: "don-narxlari-2024" },
  { title: "Organik dehqonchilik — kelajak talabi", date: "12 May, 2024", views: "7.2K", seed: "pop-4", slug: "bioogit-loyihalari" },
  { title: "Yangi agro texnika yarmarkasi o'tkazildi", date: "10 May, 2024", views: "6.1K", seed: "pop-5", slug: "avtomatik-traktorlar" },
]

export const themes = ["Barchasi", "Sug'orish", "Texnika", "Eksport", "Subsidiya", "Iqlim"]
export const dates = ["Barchasi", "Bugun", "Bu hafta", "Bu oy", "Bu yil"]
export const newsImg = (seed: string, w = 640, h = 400) => `https://picsum.photos/seed/${seed}/${w}/${h}`
export const findNews = (slug?: string) => news.find((n) => n.slug === slug)
