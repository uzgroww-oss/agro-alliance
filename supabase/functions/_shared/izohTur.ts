/**
 * IZOHNING UMUMIY SHAKLI.
 *
 * YouTube, Instagram, Facebook va Telegram izohni butunlay boshqacha
 * qaytaradi. Ularni bitta shaklga keltirmasa, panel va avtomatik
 * yurish har tarmoq uchun alohida yozilishi kerak bo'lardi — bir xil
 * mantiq to'rt marta.
 *
 * Alohida kichik fayl: bu turni adapterlar ham (`ytIzoh`, `metaIzoh`,
 * `tgIzoh`), dispetcher ham (`izohManba`) import qiladi. Bitta joyga
 * qo'yilsa aylanma bog'liqlik hosil bo'lardi.
 */
export type UmumIzoh = {
  /** Izohning tarmoqdagi identifikatori — javob shunga ulanadi */
  id: string
  /** Qaysi post/video/media ostida */
  postId: string
  /** Post sarlavhasi yoki matnining boshi — panelda ko'rsatish uchun */
  postTitle: string
  /** Postga havola (bo'lmasligi mumkin) */
  havola: string
  muallif: string
  /** Izohni O'ZIMIZ yozganmizmi — o'z izohimizga javob yozilmaydi */
  ozimizmi: boolean
  matn: string
  /** ISO vaqt; tartiblash shu bo'yicha */
  vaqt: string
  yoqtirish: number
  /** Javob yozish mumkinmi (yopilgan ip, o'chirilgan post) */
  javobMumkin: boolean
  /** Kanal O'ZI shu izohga allaqachon javob berganmi (qo'lda ham) */
  javobBerilgan: boolean
}
