-- Add missing RLS policies for student_sgpa table to allow teachers to insert/update records

-- Allow teachers to insert SGPA records
DROP POLICY IF EXISTS "Teachers can insert SGPA" ON student_sgpa;
CREATE POLICY "Teachers can insert SGPA" ON student_sgpa
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'teacher'
  ));

-- Allow teachers to update SGPA records
DROP POLICY IF EXISTS "Teachers can update SGPA" ON student_sgpa;
CREATE POLICY "Teachers can update SGPA" ON student_sgpa
  FOR UPDATE USING (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'teacher'
  ));

-- Allow teachers to view all SGPA records (for reporting purposes)
DROP POLICY IF EXISTS "Teachers can view SGPA" ON student_sgpa;
CREATE POLICY "Teachers can view SGPA" ON student_sgpa
  FOR SELECT USING (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'teacher'
  ) OR auth.uid()::text = student_id);