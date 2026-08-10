import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  /**
   * `.history` va `.mimocode` — muharrirning avtomatik zaxira nusxalari.
   * Ular gitga kirmaydi, lekin ESLint ularni tekshirar edi: 268 xatoning
   * 250 dan ortig'i o'sha eski nusxalardan chiqardi va haqiqiy
   * ogohlantirishlar shovqin ichida ko'rinmasdi.
   *
   * `supabase/functions` — Deno kodi (URL importlari, Deno global).
   * Uni Node uchun sozlangan ESLint tushunmaydi; tekshiruvi alohida:
   * `npx deno check` va `npm test`.
   */
  globalIgnores(['dist', '.history', '.mimocode', 'supabase/functions']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
