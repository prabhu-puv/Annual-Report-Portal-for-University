-- Create a secure RPC function to fetch a student's exact semester rank
-- This runs with SECURITY DEFINER to bypass RLS restrictions safely
-- It calculates the normalized 10-scale SGPA score, then ranks it against peers in the same semester.

CREATE OR REPLACE FUNCTION get_semester_rank(p_student_id TEXT, p_semester TEXT)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    student_score numeric;
    student_rank integer;
BEGIN
    -- get the specific student's score, normalized to 10 scale
    SELECT CASE WHEN sgpa <= 4 THEN sgpa * 2.5 ELSE sgpa END INTO student_score
    FROM student_sgpa
    WHERE student_id = p_student_id AND semester = p_semester
    LIMIT 1;

    IF student_score IS NULL THEN
        RETURN 0;
    END IF;

    -- calculate the exact standard rank of that score inside the semester cohort
    SELECT COUNT(*) + 1 INTO student_rank
    FROM (
        SELECT CASE WHEN sgpa <= 4 THEN sgpa * 2.5 ELSE sgpa END AS norm_score
        FROM student_sgpa
        WHERE semester = p_semester
    ) AS cohort
    WHERE norm_score > student_score;

    RETURN student_rank;
END;
$$;
