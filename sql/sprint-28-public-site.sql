-- ============================================================================
-- Sprint 28: Tenant Public Website (เว็บ public รายโรงเรียน)
-- ============================================================================
-- Anonymous (no-login) public RPCs that expose ONLY safe public fields of a
-- school + its PUBLISHED news/events. Resolves a school by slug or custom_domain.
-- SECURITY DEFINER + GRANT to anon — curated columns only (never billing/omise/status).
-- Created: 2026-05-28
-- ============================================================================

-- 1. get_public_school(slug | domain) → safe public info
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_public_school(p_slug text DEFAULT NULL, p_domain text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF COALESCE(p_slug,'') = '' AND COALESCE(p_domain,'') = '' THEN
    RETURN jsonb_build_object('error','no_key');
  END IF;
  SELECT jsonb_build_object(
    'id', s.id, 'slug', s.slug,
    'name', COALESCE(s.school_name_th, s.school_name, s.name),
    'name_en', s.school_name,
    'address', s.school_address, 'phone', s.school_phone, 'email', s.school_email,
    'website', s.school_website, 'motto', COALESCE(s.motto_th, s.motto),
    'principal', COALESCE(s.principal_name_th, s.principal_name),
    'about', s.description
  ) INTO v
  FROM public.schools s
  WHERE (NULLIF(p_slug,'') IS NOT NULL AND lower(s.slug) = lower(p_slug))
     OR (NULLIF(p_domain,'') IS NOT NULL AND lower(s.custom_domain) = lower(p_domain))
  LIMIT 1;

  IF v IS NULL THEN RETURN jsonb_build_object('error','not_found'); END IF;
  RETURN jsonb_build_object('success', true, 'school', v);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_school TO anon, authenticated;

-- 2. get_public_news(school_id) → published news
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_public_news(p_school_id uuid, p_limit int DEFAULT 12)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF p_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT jsonb_agg(row_to_json(t)) INTO v FROM (
    SELECT n.id, COALESCE(n.title_th, n.title) AS title, n.excerpt, n.content, n.image_url, n.created_at
    FROM public.news n
    WHERE n.school_id = p_school_id AND COALESCE(n.published, false) = true
    ORDER BY n.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit,12), 50))
  ) t;
  RETURN COALESCE(v, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN RETURN '[]'::jsonb;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_news TO anon, authenticated;

-- 3. get_public_events(school_id) → published, upcoming-first
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_public_events(p_school_id uuid, p_limit int DEFAULT 12)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF p_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT jsonb_agg(row_to_json(t)) INTO v FROM (
    SELECT e.id, COALESCE(e.title_th, e.title) AS title, e.description, e.event_date, e.location
    FROM public.events e
    WHERE e.school_id = p_school_id AND COALESCE(e.published, false) = true
    ORDER BY (e.event_date >= current_date) DESC, e.event_date ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit,12), 50))
  ) t;
  RETURN COALESCE(v, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN RETURN '[]'::jsonb;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_events TO anon, authenticated;

-- ============================================================================
-- Verify (anon):
-- SELECT public.get_public_school('suansonkk', NULL);
-- SELECT public.get_public_school(NULL, 'suansonkk.com');
-- SELECT public.get_public_news('<school_id>');
-- SELECT public.get_public_events('<school_id>');
-- ============================================================================
-- NOTE: the news.published / events.published columns are assumed to exist
-- (used by news-admin.html / events-admin.html). If a column name differs the
-- function returns [] gracefully (EXCEPTION → empty) — tell Claude to adjust.
