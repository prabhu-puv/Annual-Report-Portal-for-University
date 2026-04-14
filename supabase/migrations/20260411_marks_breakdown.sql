-- Add internal marks breakdown columns to marks table
ALTER TABLE marks
  ADD COLUMN IF NOT EXISTS assignment_marks DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiz_marks       DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mid_sem_marks    DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Constraints: max values enforced at app level, add check constraints here too
ALTER TABLE marks
  ADD CONSTRAINT chk_assignment_marks CHECK (assignment_marks >= 0 AND assignment_marks <= 15),
  ADD CONSTRAINT chk_quiz_marks       CHECK (quiz_marks >= 0 AND quiz_marks <= 15),
  ADD CONSTRAINT chk_mid_sem_marks    CHECK (mid_sem_marks >= 0 AND mid_sem_marks <= 20);

-- Back-fill existing rows: split internal_marks proportionally
-- (assignment 15/50, quiz 15/50, mid_sem 20/50 of internal_marks)
UPDATE marks SET
  assignment_marks = ROUND((internal_marks * 15.0 / 50.0)::NUMERIC, 2),
  quiz_marks       = ROUND((internal_marks * 15.0 / 50.0)::NUMERIC, 2),
  mid_sem_marks    = ROUND((internal_marks * 20.0 / 50.0)::NUMERIC, 2)
WHERE assignment_marks = 0 AND quiz_marks = 0 AND mid_sem_marks = 0 AND internal_marks > 0;
