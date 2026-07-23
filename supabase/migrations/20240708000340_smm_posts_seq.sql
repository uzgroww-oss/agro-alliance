-- Postlar ro'yxatida ko'rsatish uchun qisqa, o'qiladigan raqam.
--
-- NEGA: id — UUID. Panelda "#a3f9c2e1-…" ko'rsatib bo'lmaydi, xodimlar
-- bir-biriga post haqida gapirganda ham qisqa raqam kerak.
--
-- bigserial ALTER TABLE da mavjud qatorlarni ham avtomatik to'ldiradi,
-- shuning uchun alohida backfill kerak emas.
alter table public.smm_posts
  add column if not exists seq bigserial;

-- 1000 dan boshlaganimiz ma'qul: "#12" dan ko'ra "#1012" ishonchliroq
-- ko'rinadi va kelajakda uzunlik o'zgarmaydi.
do $$
declare
  cur bigint;
begin
  select last_value into cur from public.smm_posts_seq_seq;
  if cur < 1000 then
    perform setval('public.smm_posts_seq_seq', 1000, false);
  end if;
end $$;

create index if not exists smm_posts_seq_idx on public.smm_posts (seq desc);
