-- Enable UUID extension for generated UUID values
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  credits INTEGER NOT NULL,
  max_marks INTEGER DEFAULT 100,
  semester VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create marks table
CREATE TABLE IF NOT EXISTS marks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  student_id VARCHAR(50) NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  internal_marks DECIMAL(5,2) NOT NULL DEFAULT 0,
  external_marks DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_marks DECIMAL(5,2) GENERATED ALWAYS AS (internal_marks + external_marks) STORED,
  grade VARCHAR(5),
  sgpa DECIMAL(3,2),
  semester VARCHAR(10) NOT NULL,
  academic_year VARCHAR(10) NOT NULL,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(subject_id, student_id, semester, academic_year)
);

-- Create grade_scale table for GPA calculations
CREATE TABLE IF NOT EXISTS grade_scale (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade VARCHAR(5) UNIQUE NOT NULL,
  min_percentage DECIMAL(5,2) NOT NULL,
  max_percentage DECIMAL(5,2) NOT NULL,
  gpa_points DECIMAL(3,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create student_sgpa table for CGPA tracking
CREATE TABLE IF NOT EXISTS student_sgpa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id VARCHAR(50) NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  semester VARCHAR(10) NOT NULL,
  academic_year VARCHAR(10) NOT NULL,
  sgpa DECIMAL(3,2) NOT NULL,
  cgpa DECIMAL(3,2),
  total_credits INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, semester, academic_year)
);

-- Insert default grade scale
INSERT INTO grade_scale (grade, min_percentage, max_percentage, gpa_points) VALUES
  ('A+', 90, 100, 4.0),
  ('A', 80, 89.99, 3.75),
  ('B+', 70, 79.99, 3.5),
  ('B', 60, 69.99, 3.0),
  ('C', 50, 59.99, 2.0),
  ('F', 0, 49.99, 0.0)
ON CONFLICT (grade) DO NOTHING;

-- Insert sample subjects
INSERT INTO subjects (code, name, credits, max_marks, semester) VALUES
  ('MATH101', 'Mathematics – I', 4, 100, 'I'),
  ('PHY101', 'Engineering Physics', 4, 100, 'I'),
  ('CHEM101', 'Engineering Chemistry', 4, 100, 'I'),
  ('EEE101', 'Basic Electrical Engineering', 3, 100, 'I'),
  ('C101', 'Programming in C', 4, 100, 'I'),
  ('EG101', 'Engineering Graphics', 3, 100, 'I'),
  ('CSL101', 'Communication Skills Lab', 1, 100, 'I'),
  ('CPL101', 'C Programming Lab', 1, 100, 'I'),
  ('MATH102', 'Mathematics – II', 4, 100, 'II'),
  ('DS101', 'Data Structures', 4, 100, 'II'),
  ('DLD101', 'Digital Logic Design', 4, 100, 'II'),
  ('CO101', 'Computer Organization', 4, 100, 'II'),
  ('EVS101', 'Environmental Studies', 3, 100, 'II'),
  ('OOP101', 'Object Oriented Programming (Java/C++)', 4, 100, 'II'),
  ('DSL101', 'Data Structures Lab', 1, 100, 'II'),
  ('OOPL101', 'OOP Lab', 1, 100, 'II'),
  ('MATH201', 'Engineering Mathematics – III', 4, 100, 'III'),
  ('DBMS101', 'Database Management Systems', 4, 100, 'III'),
  ('OS101', 'Operating Systems', 4, 100, 'III'),
  ('CN101', 'Computer Networks', 4, 100, 'III'),
  ('OOP201', 'Object Oriented Programming', 4, 100, 'III'),
  ('SE101', 'Software Engineering', 3, 100, 'III'),
  ('DBMSL101', 'DBMS Lab', 1, 100, 'III'),
  ('OSL101', 'OS Lab', 1, 100, 'III'),
  ('ADA101', 'Design & Analysis of Algorithms', 4, 100, 'IV'),
  ('MPMC101', 'Microprocessors & Microcontrollers', 4, 100, 'IV'),
  ('WT101', 'Web Technologies', 4, 100, 'IV'),
  ('TC101', 'Theory of Computation', 3, 100, 'IV'),
  ('CG101', 'Computer Graphics', 3, 100, 'IV'),
  ('ALGL101', 'Algorithms Lab', 1, 100, 'IV'),
  ('WTL101', 'Web Technology Lab', 1, 100, 'IV'),
  ('MP101', 'Mini Project', 2, 100, 'IV'),
  ('AI101', 'Artificial Intelligence', 4, 100, 'V'),
  ('ML101', 'Machine Learning', 4, 100, 'V'),
  ('CC101', 'Cloud Computing', 4, 100, 'V'),
  ('IS101', 'Information Security', 4, 100, 'V'),
  ('MAD101', 'Mobile Application Development', 4, 100, 'V'),
  ('AIL101', 'AI Lab', 1, 100, 'V'),
  ('MLL101', 'ML Lab', 1, 100, 'V'),
  ('INT101', 'Internship / Industrial Training', 2, 100, 'V'),
  ('BDA101', 'Big Data Analytics', 4, 100, 'VI'),
  ('IOT101', 'Internet of Things (IoT)', 4, 100, 'VI'),
  ('DM101', 'Data Mining', 4, 100, 'VI'),
  ('DEVOPS101', 'DevOps', 4, 100, 'VI'),
  ('BC101', 'Blockchain Technology (Elective)', 4, 100, 'VI'),
  ('BDL101', 'Big Data Lab', 1, 100, 'VI'),
  ('IOTL101', 'IoT Lab', 1, 100, 'VI'),
  ('MP2101', 'Mini Project II', 2, 100, 'VI'),
  ('DL101', 'Deep Learning', 4, 100, 'VII'),
  ('NLP101', 'Natural Language Processing', 4, 100, 'VII'),
  ('DSYS101', 'Distributed Systems', 4, 100, 'VII'),
  ('ELEC101', 'Elective I', 4, 100, 'VII'),
  ('ELEC102', 'Elective II', 4, 100, 'VII'),
  ('P1A101', 'Project Phase 1', 3, 100, 'VII'),
  ('SEM101', 'Seminar', 1, 100, 'VII'),
  ('MP3101', 'Major Project Phase 2', 4, 100, 'VIII'),
  ('PE101', 'Professional Ethics', 3, 100, 'VIII'),
  ('ED101', 'Entrepreneurship Development', 3, 100, 'VIII'),
  ('ELEC103', 'Elective III', 4, 100, 'VIII'),
  ('VIVA101', 'Comprehensive Viva', 1, 100, 'VIII'),
  ('INT102', 'Internship / Industry Project', 2, 100, 'VIII')
ON CONFLICT (code) DO NOTHING;

-- Enable RLS
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_scale ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_sgpa ENABLE ROW LEVEL SECURITY;

-- Create policies for marks table
DROP POLICY IF EXISTS "Teachers can view marks" ON marks;
CREATE POLICY "Teachers can view marks" ON marks
  FOR SELECT USING (auth.uid() = teacher_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Students can view own marks" ON marks;
CREATE POLICY "Students can view own marks" ON marks
  FOR SELECT USING (auth.uid()::text = student_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Teachers can insert marks" ON marks;
CREATE POLICY "Teachers can insert marks" ON marks
  FOR INSERT WITH CHECK (auth.uid() = teacher_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Teachers can update marks" ON marks;
CREATE POLICY "Teachers can update marks" ON marks
  FOR UPDATE USING (auth.uid() = teacher_id OR auth.role() = 'service_role');

-- Create policies for subjects table
DROP POLICY IF EXISTS "Anyone can view subjects" ON subjects;
CREATE POLICY "Anyone can view subjects" ON subjects
  FOR SELECT USING (true);

-- Create policies for grade_scale table
DROP POLICY IF EXISTS "Anyone can view grade scale" ON grade_scale;
CREATE POLICY "Anyone can view grade scale" ON grade_scale
  FOR SELECT USING (true);

-- Create policies for student_sgpa table
DROP POLICY IF EXISTS "Students can view own SGPA" ON student_sgpa;
CREATE POLICY "Students can view own SGPA" ON student_sgpa
  FOR SELECT USING (auth.uid()::text = student_id OR auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marks_student_id ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject_id ON marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_marks_semester ON marks(semester);
CREATE INDEX IF NOT EXISTS idx_student_sgpa_student_id ON student_sgpa(student_id);

-- Create function to calculate grade
CREATE OR REPLACE FUNCTION calculate_grade(total_marks DECIMAL)
RETURNS VARCHAR AS $$
BEGIN
  IF total_marks >= 90 THEN RETURN 'A+';
  ELSIF total_marks >= 80 THEN RETURN 'A';
  ELSIF total_marks >= 70 THEN RETURN 'B+';
  ELSIF total_marks >= 60 THEN RETURN 'B';
  ELSIF total_marks >= 50 THEN RETURN 'C';
  ELSE RETURN 'F';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate SGPA
CREATE OR REPLACE FUNCTION calculate_sgpa(total_marks DECIMAL, credits INTEGER)
RETURNS DECIMAL AS $$
DECLARE
  gpa_points DECIMAL;
BEGIN
  SELECT gs.gpa_points INTO gpa_points
  FROM grade_scale gs
  WHERE total_marks >= gs.min_percentage AND total_marks <= gs.max_percentage;
  
  RETURN COALESCE(gpa_points * credits::DECIMAL / NULLIF(credits, 0), 0);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate grade and SGPA on marks insert/update
CREATE OR REPLACE FUNCTION update_marks_calculations()
RETURNS TRIGGER AS $$
BEGIN
  NEW.grade := calculate_grade(NEW.total_marks);
  NEW.sgpa := calculate_sgpa(NEW.total_marks, (SELECT credits FROM subjects WHERE id = NEW.subject_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS marks_calculations_trigger ON marks;
CREATE TRIGGER marks_calculations_trigger
BEFORE INSERT OR UPDATE ON marks
FOR EACH ROW
EXECUTE FUNCTION update_marks_calculations();
