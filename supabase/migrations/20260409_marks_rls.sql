-- RLS policies for marks table so students can read their own marks
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;

-- Drop existing if any
DROP POLICY IF EXISTS "Students can view their own marks" ON marks;
DROP POLICY IF EXISTS "Teachers can manage marks" ON marks;

-- Students can SELECT their own marks
CREATE POLICY "Students can view their own marks" ON marks
  FOR SELECT
  USING (auth.uid()::text = student_id OR auth.uid() = teacher_id);

-- Teachers can INSERT/UPDATE/DELETE marks they created
CREATE POLICY "Teachers can manage marks" ON marks
  FOR ALL
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- Same for student_sgpa
ALTER TABLE student_sgpa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own sgpa" ON student_sgpa;
DROP POLICY IF EXISTS "Teachers can manage sgpa" ON student_sgpa;

CREATE POLICY "Students can view their own sgpa" ON student_sgpa
  FOR SELECT
  USING (auth.uid()::text = student_id);

CREATE POLICY "Teachers can manage sgpa" ON student_sgpa
  FOR ALL
  USING (auth.role() = 'authenticated');
