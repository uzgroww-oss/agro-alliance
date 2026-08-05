import { handleCors } from "../_shared/cors.ts"
import { errorResponse } from "../_shared/response.ts"

import { run as royxat } from "../_shared/partners/list.ts"
import { run as yaratish } from "../_shared/partners/create.ts"
import { run as yangilash } from "../_shared/partners/update.ts"
import { run as ochirish } from "../_shared/partners/delete.ts"
import { run as vazifaQosh } from "../_shared/partners/tasks-add.ts"
import { run as vazifaHolat } from "../_shared/partners/tasks-cycle.ts"
import { run as vazifaOchir } from "../_shared/partners/tasks-delete.ts"
import { run as mijozYarat } from "../_shared/partners/client-create.ts"
import { run as mijozOchir } from "../_shared/partners/client-delete.ts"

/**
 * HAMKORLAR — BARCHA AMALLAR BITTA FUNKSIYADA.
 *
 * Ilgari to'qqizta alohida edge funksiya edi: list, create, update,
 * delete, tasks-add, tasks-cycle, tasks-delete, client-create,
 * client-delete. Supabase loyihada ~100 ta funksiyaga ruxsat beradi
 * va biz chegaraga yetgan edik — bitta resurs uchun to'qqiz slot
 * ketishi isrof.
 *
 * MUHIM: amallarning KODI o'zgarmadi. Har biri `_shared/partners/`
 * ichiga ko'chirildi va shu yerdan chaqiriladi — ya'ni so'rov va
 * javob shakli, tekshiruvlar, xato matnlari avvalgidek. Bu ataylab:
 * qayta yozish yangi xato keltirar edi, ko'chirish esa keltirmaydi.
 * Har bir amal o'z `requireRole` tekshiruvini saqlab qoldi.
 *
 * MARSHRUTLASH `op` parametri bo'yicha (mijozda api.ts qo'yadi):
 *   (yo'q)      GET     -> ro'yxat
 *   (yo'q)      POST    -> yangi hamkor
 *   op=item     PATCH   -> tahrirlash        (id)
 *   op=item     DELETE  -> o'chirish         (id)
 *   op=tasks    POST    -> vazifa qo'shish   (pid)
 *   op=task     PATCH   -> vazifa holati     (pid, tid)
 *   op=task     DELETE  -> vazifa o'chirish  (pid, tid)
 *   op=client   POST    -> mijoz hisobi      (pid)
 *   op=client   DELETE  -> hisobni uzish     (pid)
 */
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const op = new URL(req.url).searchParams.get("op") || ""
  const m = req.method

  if (!op) {
    if (m === "POST") return yaratish(req)
    return royxat(req)
  }
  if (op === "item") {
    if (m === "PATCH") return yangilash(req)
    if (m === "DELETE") return ochirish(req)
  }
  if (op === "tasks" && m === "POST") return vazifaQosh(req)
  if (op === "task") {
    if (m === "PATCH") return vazifaHolat(req)
    if (m === "DELETE") return vazifaOchir(req)
  }
  if (op === "client") {
    if (m === "POST") return mijozYarat(req)
    if (m === "DELETE") return mijozOchir(req)
  }

  return errorResponse(`Noma'lum amal: op=${op || "(yo'q)"} ${m}`, 400)
})
