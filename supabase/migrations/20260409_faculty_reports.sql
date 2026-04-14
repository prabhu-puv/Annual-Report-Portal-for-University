-- Create faculty_reports table for reports uploaded by faculty
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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_faculty_reports_semester_year ON faculty_reports(semester, academic_year);
CREATE INDEX IF NOT EXISTS idx_faculty_reports_uploaded_by ON faculty_reports(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_faculty_reports_created_at ON faculty_reports(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE faculty_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Faculty can view all reports, students can only view reports from their semester/academic year
-- For now, allowing all authenticated users to view reports (can be refined based on requirements)
CREATE POLICY "Faculty can manage their reports" ON faculty_reports
  FOR ALL USING (auth.uid() = uploaded_by);

CREATE POLICY "Students can view reports" ON faculty_reports
  FOR SELECT USING (auth.role() = 'authenticated');

-- Sample report inserts are omitted because `uploaded_by` must reference an existing auth user.
-- Add sample faculty reports manually after creating valid auth users, or replace the
-- placeholder IDs above with real user IDs from your Supabase auth.users table.
