import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, "data.json")

let data = { users: [], seq: 1 }

export function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"))
    }
  } catch {
    data = { users: [], seq: 1 }
  }
  if (!data.partners) data.partners = []
  if (!data.stats) data.stats = []
  return data
}

export function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

export function nextId() {
  return data.seq++
}

export const db = {
  get users() {
    return data.users
  },
  findUserByEmail(email) {
    return data.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())
  },
  findUserById(id) {
    return data.users.find((u) => u.id === Number(id))
  },
  addUser(u) {
    data.users.push(u)
    save()
    return u
  },
  removeUser(id) {
    const i = data.users.findIndex((u) => u.id === Number(id))
    if (i >= 0) {
      data.users.splice(i, 1)
      save()
      return true
    }
    return false
  },
  // ---- partners ----
  get partners() {
    return data.partners
  },
  findPartner(id) {
    return data.partners.find((p) => p.id === Number(id))
  },
  addPartner(p) {
    data.partners.push(p)
    save()
    return p
  },
  removePartner(id) {
    const i = data.partners.findIndex((p) => p.id === Number(id))
    if (i >= 0) {
      data.partners.splice(i, 1)
      save()
      return true
    }
    return false
  },
  // ---- site stats (counters) ----
  get stats() {
    return data.stats
  },
  setStats(arr) {
    data.stats = arr
    save()
    return arr
  },
  save,
}
