-- ============================================================================
-- `log_ingestion` — YETISHMAYOTGAN FUNKSIYA
-- ============================================================================
-- Fon ishlari (rss-ingest, web-crawler, ai-*) har bosqichda shu funksiyani
-- chaqiradi, lekin u bazada YO'Q edi — tekshirilganda PostgREST 404
-- qaytardi (PGRST202: "Searched for the function public.log_ingestion").
--
-- Ya'ni yangilik yig'ish quvuri ishga tushirilganda birinchi log
-- yozuvidayoq yiqilardi. `news_ingestion_logs` jadvali esa
-- 20240708000010 migratsiyasidan beri mavjud — faqat unga yozadigan
-- funksiya yozilmagan.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_ingestion(
  p_job_id     uuid    DEFAULT NULL,
  p_source_id  uuid    DEFAULT NULL,
  p_event_type varchar DEFAULT 'progress',
  p_message    text    DEFAULT NULL,
  p_metadata   jsonb   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
-- Qidiruv yo'li qat'iy: SECURITY DEFINER funksiyada uni ochiq
-- qoldirish begona sxemadagi obyektni chaqirtirib yuborish xavfini
-- tug'diradi.
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.news_ingestion_logs (job_id, source_id, event_type, message, metadata)
  VALUES (p_job_id, p_source_id, p_event_type, p_message, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  -- Log yozilmagani ISHNI TO'XTATMASLIGI kerak: yig'ish quvuri
  -- yozuvlar uchun emas, yangiliklar uchun ishlaydi.
  RAISE WARNING 'log_ingestion: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- Faqat server tomoni chaqiradi (edge funksiyalar service role bilan).
REVOKE ALL ON FUNCTION public.log_ingestion(uuid, uuid, varchar, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_ingestion(uuid, uuid, varchar, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_ingestion(uuid, uuid, varchar, text, jsonb) TO service_role;
