-- ============================================================
-- Run this in Supabase SQL Editor
-- Sets up faculty_reports table + correct RLS policies
-- ============================================================

-- Create table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS faculty_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size VARCHAR(50),
  file_type VARCHAR(100),
  semester VARCHAR(10) NOT NULL,
  academic_year VARCHAR(10) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  faculty_name VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  is_public BOOLEAN DEFAULT true,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_faculty_reports_uploaded_by ON faculty_reports(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_faculty_reports_is_public ON faculty_reports(is_public);
CREATE INDEX IF NOT EXISTS idx_faculty_reports_created_at ON faculty_reports(created_at DESC);

-- Enable RLS
ALTER TABLE faculty_reports ENABLE ROW LEVEL SECURITY;

-- Drop old policies to avoid conflicts
DROP POLICY IF EXISTS "Faculty can manage their reports" ON faculty_reports;
DROP POLICY IF EXISTS "Students can view reports" ON faculty_reports;
DROP POLICY IF EXISTS "Anyone can view public reports" ON faculty_reports;
DROP POLICY IF EXISTS "Faculty manage own reports" ON faculty_reports;
DROP POLICY IF EXISTS "Authenticated users can increment download count" ON faculty_reports;

-- POLICY 1: Teachers can INSERT/UPDATE/DELETE their own reports
CREATE POLICY "Faculty manage own reports" ON faculty_reports
  FOR ALL
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

-- POLICY 2: Any authenticated user can SELECT public reports
CREATE POLICY "Anyone can view public reports" ON faculty_reports
  FOR SELECT
  USING (is_public = true AND auth.role() = 'authenticated');

-- POLICY 3: Any authenticated user can UPDATE download_count
CREATE POLICY "Authenticated users can increment download count" ON faculty_reports
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
