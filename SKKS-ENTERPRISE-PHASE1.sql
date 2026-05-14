-- ==============================================
-- 🎓 ENTERPRISE FEATURES — Phase 1 SQL Setup
-- ==============================================
-- สำหรับ SKKS Enterprise:
-- 1. subjects (วิชา)
-- 2. grade_scales (เกณฑ์การให้คะแนน)
-- 3. assignments (งาน/ข้อสอบ)
-- 4. student_grades (คะแนนนักเรียน)
-- 5. report_cards (ใบเกรด)
-- 6. certificates (ใบประกาศ)
-- 7. attendance (เช็คชื่อ)
-- 8. line_settings (LINE Notify)
-- ==============================================

-- =====================================
-- 1. SUBJECTS (วิชาเรียน)
-- =====================================
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_th TEXT,
  program TEXT,
  grade_level TEXT,
  credits NUMERIC(3,1) DEFAULT 1.0,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read subjects" ON subjects;
CREATE POLICY "Public read subjects" ON subjects FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Staff manage subjects" ON subjects;
CREATE POLICY "Staff manage subjects" ON subjects FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'owner', 'developer'))
);

INSERT INTO subjects (code, name, name_th, program, grade_level, credits, display_order) VALUES
('ENG-EP', 'English Language', 'ภาษาอังกฤษ', 'ep', 'all', 2.0, 1),
('MAT-EP', 'Mathematics', 'คณิตศาสตร์', 'ep', 'all', 2.0, 2),
('SCI-EP', 'Science', 'วิทยาศาสตร์', 'ep', 'all', 1.5, 3),
('SOC-EP', 'Social Studies', 'สังคมศึกษา', 'ep', 'all', 1.0, 4),
('THA-EP', 'Thai Language', 'ภาษาไทย', 'ep', 'all', 1.5, 5),
('PE-EP', 'Physical Education', 'พลศึกษา', 'ep', 'all', 0.5, 6),
('ART-EP', 'Art', 'ศิลปะ', 'ep', 'all', 0.5, 7),
('MUS-EP', 'Music', 'ดนตรี', 'ep', 'all', 0.5, 8),
('COM-EP', 'Computer Science', 'คอมพิวเตอร์', 'ep', 'all', 1.0, 9),
('ENG-MEP', 'English', 'ภาษาอังกฤษ', 'mep', 'all', 1.5, 1),
('MAT-MEP', 'Mathematics', 'คณิตศาสตร์', 'mep', 'all', 2.0, 2),
('SCI-MEP', 'Science', 'วิทยาศาสตร์', 'mep', 'all', 1.5, 3),
('THA-MEP', 'Thai Language', 'ภาษาไทย', 'mep', 'all', 2.0, 4),
('SOC-MEP', 'Social Studies', 'สังคมศึกษา', 'mep', 'all', 1.5, 5)
ON CONFLICT (code) DO NOTHING;

-- =====================================
-- 2. GRADE SCALES (เกณฑ์การให้คะแนน)
-- =====================================
CREATE TABLE IF NOT EXISTS grade_scales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  grade TEXT NOT NULL,
  min_score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) NOT NULL,
  gpa NUMERIC(3,2) NOT NULL,
  description TEXT,
  description_th TEXT,
  active BOOLEAN DEFAULT true
);

ALTER TABLE grade_scales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read grade scales" ON grade_scales;
CREATE POLICY "Public read grade scales" ON grade_scales FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Owner manage grade scales" ON grade_scales;
CREATE POLICY "Owner manage grade scales" ON grade_scales FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('owner', 'developer'))
);

INSERT INTO grade_scales (grade, min_score, max_score, gpa, description, description_th) VALUES
('A+', 95, 100, 4.0, 'Outstanding', 'ดีเยี่ยม'),
('A', 90, 94.99, 4.0, 'Excellent', 'ดีมาก'),
('B+', 85, 89.99, 3.5, 'Very Good', 'ดี'),
('B', 80, 84.99, 3.0, 'Good', 'ค่อนข้างดี'),
('C+', 75, 79.99, 2.5, 'Above Average', 'พอใช้ขึ้นไป'),
('C', 70, 74.99, 2.0, 'Average', 'พอใช้'),
('D+', 65, 69.99, 1.5, 'Below Average', 'อ่อน'),
('D', 60, 64.99, 1.0, 'Pass', 'ผ่าน'),
('F', 0, 59.99, 0.0, 'Fail', 'ไม่ผ่าน')
ON CONFLICT DO NOTHING;

-- =====================================
-- 3. STUDENT GRADES
-- =====================================
CREATE TABLE IF NOT EXISTS student_grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id),
  term TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  midterm_score NUMERIC(5,2),
  final_score NUMERIC(5,2),
  assignment_score NUMERIC(5,2),
  total_score NUMERIC(5,2),
  letter_grade TEXT,
  gpa NUMERIC(3,2),
  remarks TEXT,
  teacher_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, term, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_grades_student ON student_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_term ON student_grades(term, academic_year);

ALTER TABLE student_grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parent read own child grades" ON student_grades;
CREATE POLICY "Parent read own child grades" ON student_grades FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('staff', 'owner', 'developer', 'parent')
  )
);

DROP POLICY IF EXISTS "Staff manage grades" ON student_grades;
CREATE POLICY "Staff manage grades" ON student_grades FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'owner', 'developer'))
);

-- =====================================
-- 4. REPORT CARDS
-- =====================================
CREATE TABLE IF NOT EXISTS report_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_number TEXT UNIQUE NOT NULL,
  student_id UUID REFERENCES students(id),
  term TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  total_subjects INTEGER DEFAULT 0,
  total_credits NUMERIC(5,1) DEFAULT 0,
  gpa NUMERIC(3,2),
  cumulative_gpa NUMERIC(3,2),
  rank_in_class INTEGER,
  total_in_class INTEGER,
  attendance_rate NUMERIC(5,2),
  status TEXT DEFAULT 'draft',
  issued_date DATE,
  issued_by UUID REFERENCES profiles(id),
  remarks TEXT,
  qr_verification_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_student ON report_cards(student_id);
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read report cards" ON report_cards;
CREATE POLICY "Read report cards" ON report_cards FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid())
);

DROP POLICY IF EXISTS "Staff manage report cards" ON report_cards;
CREATE POLICY "Staff manage report cards" ON report_cards FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'owner', 'developer'))
);

-- =====================================
-- 5. CERTIFICATES
-- =====================================
CREATE TABLE IF NOT EXISTS certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_number TEXT UNIQUE NOT NULL,
  student_id UUID REFERENCES students(id),
  certificate_type TEXT NOT NULL,
  title TEXT NOT NULL,
  title_th TEXT,
  description TEXT,
  description_th TEXT,
  achievement TEXT,
  issued_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  issued_by UUID REFERENCES profiles(id),
  signed_by_name TEXT,
  signed_by_title TEXT,
  template TEXT DEFAULT 'classic',
  qr_verification_code TEXT,
  pdf_url TEXT,
  status TEXT DEFAULT 'issued',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certs_student ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certs_type ON certificates(certificate_type);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public verify certificate" ON certificates;
CREATE POLICY "Public verify certificate" ON certificates FOR SELECT USING (status = 'issued');

DROP POLICY IF EXISTS "Staff manage certificates" ON certificates;
CREATE POLICY "Staff manage certificates" ON certificates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'owner', 'developer'))
);

-- =====================================
-- 6. ATTENDANCE
-- =====================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  check_in_time TIME,
  check_out_time TIME,
  notes TEXT,
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read attendance" ON attendance;
CREATE POLICY "Read attendance" ON attendance FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid())
);

DROP POLICY IF EXISTS "Staff manage attendance" ON attendance;
CREATE POLICY "Staff manage attendance" ON attendance FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'owner', 'developer'))
);

-- =====================================
-- 7. LINE NOTIFY SETTINGS
-- =====================================
CREATE TABLE IF NOT EXISTS line_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  notify_token TEXT,
  description TEXT,
  template TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE line_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manage line settings" ON line_settings;
CREATE POLICY "Owner manage line settings" ON line_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('owner', 'developer'))
);

INSERT INTO line_settings (feature, enabled, description, template) VALUES
('bill_due', false, 'แจ้งเตือนเมื่อบิลใกล้ครบกำหนด (3 วัน)', '⚠️ {student_name} มีบิลค้างชำระ ฿{amount} ครบกำหนด {due_date}'),
('payment_received', false, 'แจ้งเตือนเมื่อรับชำระเงินสำเร็จ', '✅ ได้รับชำระ ฿{amount} จาก {student_name} แล้ว'),
('grade_published', false, 'แจ้งเตือนเมื่อใบเกรดออก', '📊 ใบเกรด {term} ของ {student_name} ออกแล้ว GPA: {gpa}'),
('attendance_alert', false, 'แจ้งเตือนเมื่อนักเรียนขาดเรียน', '⏰ {student_name} ขาดเรียนวันนี้ ({date})'),
('event_reminder', false, 'แจ้งเตือนกิจกรรมโรงเรียน', '🎉 พรุ่งนี้มีกิจกรรม: {event_title}')
ON CONFLICT (feature) DO NOTHING;

-- =====================================
-- 8. SCHOOL SETTINGS (สำหรับ Certificate)
-- =====================================
CREATE TABLE IF NOT EXISTS school_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name TEXT NOT NULL DEFAULT 'Suanson Khon Kaen School',
  school_name_th TEXT DEFAULT 'โรงเรียนสวนสนขอนแก่น',
  school_address TEXT,
  school_phone TEXT,
  school_email TEXT,
  school_website TEXT,
  logo_url TEXT,
  seal_url TEXT,
  principal_name TEXT,
  principal_name_th TEXT,
  principal_title TEXT DEFAULT 'Principal',
  principal_title_th TEXT DEFAULT 'ผู้อำนวยการ',
  principal_signature_url TEXT,
  registration_number TEXT,
  established_year INTEGER,
  motto TEXT,
  motto_th TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read school settings" ON school_settings;
CREATE POLICY "Public read school settings" ON school_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner manage school settings" ON school_settings;
CREATE POLICY "Owner manage school settings" ON school_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('owner', 'developer'))
);

INSERT INTO school_settings (school_name, school_name_th, school_address, school_phone, school_email, school_website, principal_name_th, motto, motto_th)
SELECT
  'Suanson Khon Kaen School',
  'โรงเรียนสวนสนขอนแก่น',
  'Khon Kaen, Thailand',
  '+66 43 XXX XXXX',
  'info@suansonkk.com',
  'https://suansonkk.com',
  'คุณนิติธาดา สุวรรณรงค์',
  'Where Pines Grow Tall',
  'ที่ซึ่งต้นสนเติบโตสูงตระหง่าน'
WHERE NOT EXISTS (SELECT 1 FROM school_settings);

-- =====================================
-- ✅ DONE!
-- =====================================
SELECT 'subjects' AS t, COUNT(*) AS n FROM subjects
UNION ALL SELECT 'grade_scales', COUNT(*) FROM grade_scales
UNION ALL SELECT 'student_grades', COUNT(*) FROM student_grades
UNION ALL SELECT 'report_cards', COUNT(*) FROM report_cards
UNION ALL SELECT 'certificates', COUNT(*) FROM certificates
UNION ALL SELECT 'attendance', COUNT(*) FROM attendance
UNION ALL SELECT 'line_settings', COUNT(*) FROM line_settings
UNION ALL SELECT 'school_settings', COUNT(*) FROM school_settings;
