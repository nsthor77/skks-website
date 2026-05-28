-- ============================================================================
-- Sprint 22: Library (ห้องสมุด)
-- ============================================================================
-- Book catalog + borrow/return loans with copy tracking.
-- Staff manage books + issue/return loans. Everyone can browse the catalog.
-- Students/parents see their own borrowed books. Created: 2026-05-28
-- ============================================================================

-- 1. Tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  title text NOT NULL,
  author text,
  isbn text,
  category text,
  cover_url text,
  location text,                              -- shelf / ตู้
  total_copies int NOT NULL DEFAULT 1,
  available_copies int NOT NULL DEFAULT 1,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  borrow_date date DEFAULT current_date,
  due_date date,
  returned_date date,
  status text NOT NULL DEFAULT 'borrowed',    -- borrowed / returned

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Defensive
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS total_copies int DEFAULT 1;
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS available_copies int DEFAULT 1;
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.library_loans ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.library_loans ADD COLUMN IF NOT EXISTS returned_date date;
ALTER TABLE public.library_loans ADD COLUMN IF NOT EXISTS status text DEFAULT 'borrowed';

CREATE INDEX IF NOT EXISTS lb_school_idx ON public.library_books (school_id, title);
CREATE INDEX IF NOT EXISTS ll_school_status_idx ON public.library_loans (school_id, status);
CREATE INDEX IF NOT EXISTS ll_student_idx ON public.library_loans (student_id, status);
CREATE INDEX IF NOT EXISTS ll_book_idx ON public.library_loans (book_id);

COMMENT ON TABLE public.library_books IS 'Sprint 22: library catalog with copy tracking';
COMMENT ON TABLE public.library_loans IS 'Sprint 22: borrow/return records';

-- 2. updated_at triggers
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'lb_set_updated_at') THEN
    CREATE TRIGGER lb_set_updated_at BEFORE UPDATE ON public.library_books
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'll_set_updated_at') THEN
    CREATE TRIGGER ll_set_updated_at BEFORE UPDATE ON public.library_loans
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 3. RLS
-- ============================================================================
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;

-- books: everyone in school can browse; staff manage
DROP POLICY IF EXISTS lb_select_all ON public.library_books;
CREATE POLICY lb_select_all ON public.library_books
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id());

DROP POLICY IF EXISTS lb_modify_staff ON public.library_books;
CREATE POLICY lb_modify_staff ON public.library_books
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- loans: staff all; student/parent own
DROP POLICY IF EXISTS ll_select_staff ON public.library_loans;
CREATE POLICY ll_select_staff ON public.library_loans
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS ll_select_own ON public.library_loans;
CREATE POLICY ll_select_own ON public.library_loans
  FOR SELECT TO authenticated
  USING (
    school_id = public.current_school_id()
    AND (student_id = ANY(public.my_student_ids())
         OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = library_loans.student_id AND s.profile_id = auth.uid()))
  );

DROP POLICY IF EXISTS ll_modify_staff ON public.library_loans;
CREATE POLICY ll_modify_staff ON public.library_loans
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- 4. RPC: save_book (staff) — create/update; keeps available in sync with total
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_book(
  p_id uuid,
  p_title text,
  p_author text DEFAULT NULL,
  p_isbn text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_cover_url text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_total_copies int DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid; v_id uuid; v_old_total int; v_old_avail int; v_new_avail int;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('success', false, 'error', 'forbidden'); END IF;
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_school'); END IF;
  IF p_title IS NULL OR length(btrim(p_title)) = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'no_title'); END IF;
  IF COALESCE(p_total_copies,1) < 1 THEN p_total_copies := 1; END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.library_books (school_id, created_by, title, author, isbn, category, cover_url, location, total_copies, available_copies)
    VALUES (v_school_id, auth.uid(), btrim(p_title), p_author, p_isbn, p_category, p_cover_url, p_location, p_total_copies, p_total_copies)
    RETURNING id INTO v_id;
  ELSE
    SELECT total_copies, available_copies INTO v_old_total, v_old_avail
      FROM public.library_books WHERE id = p_id AND school_id = v_school_id;
    IF v_old_total IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
    -- adjust available by the change in total, never below 0
    v_new_avail := GREATEST(0, v_old_avail + (p_total_copies - v_old_total));
    UPDATE public.library_books SET
      title = btrim(p_title), author = p_author, isbn = p_isbn, category = p_category,
      cover_url = p_cover_url, location = p_location,
      total_copies = p_total_copies, available_copies = LEAST(v_new_avail, p_total_copies)
    WHERE id = p_id AND school_id = v_school_id
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_book TO authenticated;

-- 5. RPC: delete_book (staff)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_book(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('success', false, 'error', 'forbidden'); END IF;
  v_school_id := public.current_school_id();
  DELETE FROM public.library_books WHERE id = p_id AND school_id = v_school_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_book TO authenticated;

-- 6. RPC: get_books (catalog — any authenticated in school)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_books(p_search text DEFAULT NULL, p_category text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_rows jsonb; v_q text;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_q := '%' || COALESCE(btrim(p_search),'') || '%';

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.title) INTO v_rows
  FROM (
    SELECT b.*
    FROM public.library_books b
    WHERE b.school_id = v_school_id
      AND (COALESCE(btrim(p_search),'') = '' OR b.title ILIKE v_q OR COALESCE(b.author,'') ILIKE v_q OR COALESCE(b.isbn,'') ILIKE v_q)
      AND (p_category IS NULL OR b.category = p_category)
  ) t;
  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_books TO authenticated;

-- 7. RPC: borrow_book (staff) — issue a loan, decrement available
-- ============================================================================
CREATE OR REPLACE FUNCTION public.borrow_book(
  p_book_id uuid,
  p_student_id uuid,
  p_due_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_avail int; v_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('success', false, 'error', 'forbidden'); END IF;
  v_school_id := public.current_school_id();

  SELECT available_copies INTO v_avail FROM public.library_books
   WHERE id = p_book_id AND school_id = v_school_id FOR UPDATE;
  IF v_avail IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF v_avail < 1 THEN RETURN jsonb_build_object('success', false, 'error', 'none_available'); END IF;

  INSERT INTO public.library_loans (school_id, book_id, student_id, issued_by, borrow_date, due_date, status)
  VALUES (v_school_id, p_book_id, p_student_id, auth.uid(), current_date,
          COALESCE(p_due_date, current_date + 7), 'borrowed')
  RETURNING id INTO v_id;

  UPDATE public.library_books SET available_copies = available_copies - 1 WHERE id = p_book_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.borrow_book TO authenticated;

-- 8. RPC: return_book (staff) — mark returned, increment available
-- ============================================================================
CREATE OR REPLACE FUNCTION public.return_book(p_loan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_book uuid; v_status text;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('success', false, 'error', 'forbidden'); END IF;
  v_school_id := public.current_school_id();

  SELECT book_id, status INTO v_book, v_status FROM public.library_loans
   WHERE id = p_loan_id AND school_id = v_school_id;
  IF v_book IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF v_status = 'returned' THEN RETURN jsonb_build_object('success', false, 'error', 'already_returned'); END IF;

  UPDATE public.library_loans SET status = 'returned', returned_date = current_date WHERE id = p_loan_id;
  UPDATE public.library_books SET available_copies = LEAST(total_copies, available_copies + 1) WHERE id = v_book;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.return_book TO authenticated;

-- 9. RPC: get_loans (role-aware)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_loans(p_status text DEFAULT NULL, p_student_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid; v_uid uuid; v_staff boolean; v_rows jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_uid := auth.uid();
  v_staff := public.is_staff_or_higher();

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.status, t.due_date) INTO v_rows
  FROM (
    SELECT ll.*,
           b.title AS book_title, b.author AS book_author,
           s.student_number, s.first_name_th, s.last_name_th, s.first_name_en, s.last_name_en, s.classroom,
           (ll.status = 'borrowed' AND ll.due_date < current_date) AS overdue
    FROM public.library_loans ll
    JOIN public.library_books b ON b.id = ll.book_id
    JOIN public.students s ON s.id = ll.student_id
    WHERE ll.school_id = v_school_id
      AND (p_status IS NULL OR ll.status = p_status)
      AND (p_student_id IS NULL OR ll.student_id = p_student_id)
      AND (
        v_staff
        OR ll.student_id = ANY(public.my_student_ids())
        OR EXISTS (SELECT 1 FROM public.students s2 WHERE s2.id = ll.student_id AND s2.profile_id = v_uid)
      )
  ) t;
  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_loans TO authenticated;

-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.save_book(NULL,'แฮร์รี่ พอตเตอร์','เจ.เค. โรว์ลิ่ง','978...','นิยาย',NULL,'ชั้น A1',3);
-- SELECT public.get_books(NULL,NULL);
-- SELECT public.borrow_book('<book>','<student>','2569-06-30');
-- SELECT public.get_loans('borrowed',NULL);
-- SELECT public.return_book('<loan>');
