import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Subject {
  id: string;
  code: string;
  name: string;
  credits: number;
  maxMarks: number;
  semester: string;
}

interface StudentOption {
  id: string;
  name: string;
  label: string;
}

interface StudentMark {
  rowId: string;
  studentUserId: string | null;
  studentName: string;
  // Internal breakdown (total = 50)
  assignmentMarks: number;  // max 15
  quizMarks: number;        // max 15
  midSemMarks: number;      // max 20
  internalMarks: number;    // computed: assignment + quiz + midSem (stored in DB)
  // External
  semExamMarks: number;     // max 50  (stored as external_marks in DB)
  totalMarks?: number;      // internalMarks + semExamMarks (max 100)
  grade?: string;
}

const BLANK_ROW = (): StudentMark => ({
  rowId: `row-${Date.now()}-${Math.random()}`,
  studentUserId: null,
  studentName: '',
  assignmentMarks: 0,
  quizMarks: 0,
  midSemMarks: 0,
  internalMarks: 0,
  semExamMarks: 0,
  totalMarks: 0,
  grade: '-',
});

const TeacherReportGenerator = () => {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();
  const [semester, setSemester] = useState('III');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([{ ...BLANK_ROW(), rowId: 'row-1' }]);

  const isTeacher = role === 'teacher';

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, code, name, credits, max_marks, semester')
      .order('code', { ascending: true });

    if (error) {
      console.error('Error fetching subjects:', error);
      toast.error('Failed to load subjects. Please check the database.');
      return;
    }

    const formattedSubjects = (data ?? []).map(subject => ({
      id: subject.id,
      code: subject.code,
      name: subject.name,
      credits: subject.credits,
      maxMarks: subject.max_marks,
      semester: subject.semester,
    }));

    setSubjects(formattedSubjects);
  };

  const fetchStudents = async (sem: string) => {
    // Fetch only students enrolled in the selected semester
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, full_name, enrollment_number')
      .eq('semester', sem)
      .order('enrollment_number', { ascending: true });

    if (profileError) {
      console.error('Error fetching student profiles:', profileError);
      toast.error('Failed to load student profiles.');
      return;
    }

    const formattedStudents = (profileData ?? []).map(profile => ({
      id: profile.user_id,
      name: profile.full_name || 'Student',
      label: profile.enrollment_number
        ? `${profile.enrollment_number} — ${profile.full_name || 'Unknown'}`
        : profile.full_name || profile.user_id,
    }));

    setStudents(formattedStudents);
    // Reset student selections when semester changes
    setStudentMarks([{ rowId: 'row-1', studentUserId: null, studentName: '', internalMarks: 0, externalMarks: 0 }]);
  };

  useEffect(() => {
    fetchSubjects();
    fetchStudents(semester);
  }, []);

  // Re-fetch students whenever semester changes
  useEffect(() => {
    fetchStudents(semester);
  }, [semester]);

  useEffect(() => {
    const available = subjects.filter(subject => subject.semester === semester);
    if (available.length > 0 && !available.some(subject => subject.id === selectedSubject)) {
      setSelectedSubject(available[0].id);
    }
  }, [semester, subjects, selectedSubject]);

  const filteredSubjects = subjects.filter(subject => subject.semester === semester);

  const handleMarksChange = (
    index: number,
    field: 'assignmentMarks' | 'quizMarks' | 'midSemMarks' | 'semExamMarks',
    value: number,
  ) => {
    const maxMap = { assignmentMarks: 15, quizMarks: 15, midSemMarks: 20, semExamMarks: 50 };
    const updated = [...studentMarks];
    updated[index][field] = Math.max(0, Math.min(maxMap[field], value));
    updated[index].internalMarks =
      updated[index].assignmentMarks + updated[index].quizMarks + updated[index].midSemMarks;
    updated[index].totalMarks = updated[index].internalMarks + updated[index].semExamMarks;
    updated[index].grade = calculateGrade(updated[index].totalMarks || 0);
    setStudentMarks(updated);
  };

  const handleStudentSelection = (index: number, studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const updated = [...studentMarks];
    updated[index] = {
      ...updated[index],
      studentUserId: student?.id || null,
      studentName: student?.name || '',
    };
    setStudentMarks(updated);
  };

  const calculateGrade = (total: number): string => {
    if (total >= 90) return 'A+';
    if (total >= 80) return 'A';
    if (total >= 70) return 'B+';
    if (total >= 60) return 'B';
    if (total >= 50) return 'C';
    return 'F';
  };

  const handleSaveMarks = async () => {
    if (!selectedSubject) {
      toast.error('Please select a subject');
      return;
    }

    try {
      const subject = subjects.find(s => s.id === selectedSubject);
      if (!subject) return;

      if (studentMarks.some(mark => !mark.studentUserId)) {
        toast.error('Please select a valid student for each row before saving.');
        return;
      }

      // Prepare marks data for database
      // internal_marks = assignment + quiz + midSem (max 50)
      // external_marks = semExam (max 50)
      const marksData = studentMarks.map(mark => ({
        subject_id: selectedSubject,
        student_id: mark.studentUserId || mark.studentName,
        student_name: mark.studentName,
        assignment_marks: mark.assignmentMarks,
        quiz_marks: mark.quizMarks,
        mid_sem_marks: mark.midSemMarks,
        internal_marks: mark.internalMarks,
        external_marks: mark.semExamMarks,
        grade: mark.grade || 'F',
        semester: semester,
        academic_year: '2025-26',
        teacher_id: user?.id,
      }));

      // Insert marks into database
      const { error } = await (supabase.from('marks') as any)
        .upsert(marksData, { onConflict: 'subject_id,student_id,semester,academic_year' });

      if (error) throw error;

      // Calculate and update SGPA in student_sgpa table
      const sgpaData = studentMarks.map(mark => ({
        student_id: mark.studentUserId || mark.studentName,
        student_name: mark.studentName,
        semester: semester,
        academic_year: '2025-26',
        sgpa: Number((((mark.totalMarks || 0) / 100) * 10).toFixed(2)),
        total_credits: subject.credits,
      }));

      await (supabase.from('student_sgpa') as any)
        .upsert(sgpaData, { onConflict: 'student_id,semester,academic_year' });

      toast.success('Marks saved and SGPA calculated successfully!');
    } catch (error) {
      console.error('Error saving marks:', error);
      toast.error('Failed to save marks');
    }
  };

  const handleAddStudent = () => {
    setStudentMarks([...studentMarks, BLANK_ROW()]);
  };

  const handleRemoveStudent = (index: number) => {
    setStudentMarks(studentMarks.filter((_, i) => i !== index));
  };

  if (loading) return null;

  return (
    <DashboardLayout activeItem="Assignment Management">
      <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Marks Entry Portal</h1>
      <p className="text-muted-foreground mb-6">Enter marks: Assignment (15) + Quiz (15) + Mid Sem (20) = Internal (50) &nbsp;|&nbsp; Sem Exam (50) &nbsp;|&nbsp; Total (100)</p>

      {!isTeacher && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 rounded-3xl p-6 border border-amber-200 mb-6">
          <h2 className="text-lg font-semibold text-amber-950 mb-2">Teacher Access Required</h2>
          <p className="text-sm text-amber-900">
            This page is reserved for instructors. If you are a student, please ask your teacher to enter marks for you, or use the report card page to view your results.
          </p>
        </motion.div>
      )}

      {isTeacher && (
        <div className="grid gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-3xl p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-foreground mb-4">Select Semester & Subject</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Semester</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="I">Semester I</SelectItem>
                  <SelectItem value="II">Semester II</SelectItem>
                  <SelectItem value="III">Semester III</SelectItem>
                  <SelectItem value="IV">Semester IV</SelectItem>
                  <SelectItem value="V">Semester V</SelectItem>
                  <SelectItem value="VI">Semester VI</SelectItem>
                  <SelectItem value="VII">Semester VII</SelectItem>
                  <SelectItem value="VIII">Semester VIII</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Subject</Label>
              <Select value={selectedSubject || ''} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubjects.length > 0 ? (
                    filteredSubjects.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </SelectItem>
                    ))
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedSubject && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground">
                <strong>Subject:</strong> {subjects.find(s => s.id === selectedSubject)?.name}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Credits:</strong> {subjects.find(s => s.id === selectedSubject)?.credits}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Max Marks:</strong> {subjects.find(s => s.id === selectedSubject)?.maxMarks}
              </p>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-3xl p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Student Marks Entry</h2>
            <Button onClick={handleAddStudent} variant="secondary" size="sm">
              <Plus className="w-4 h-4" /> Add Student
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              {/* Two-row header: group + sub-columns */}
              <thead>
                <tr className="bg-indigo-50">
                  <th className="border px-4 py-2 text-sm font-semibold text-slate-700" rowSpan={2}>Student</th>
                  <th className="border px-4 py-2 text-sm font-semibold text-slate-700" rowSpan={2}>Name</th>
                  <th className="border px-3 py-2 text-sm font-semibold text-indigo-700 text-center" colSpan={4}
                      style={{ background: '#e0e7ff' }}>
                    Internal Marks (50)
                  </th>
                  <th className="border px-4 py-2 text-sm font-semibold text-amber-700 text-center"
                      style={{ background: '#fef3c7' }} rowSpan={2}>
                    Sem Exam<br/><span className="font-normal text-xs">(50)</span>
                  </th>
                  <th className="border px-4 py-2 text-sm font-semibold text-emerald-700 text-center"
                      style={{ background: '#d1fae5' }} rowSpan={2}>
                    Total<br/><span className="font-normal text-xs">(100)</span>
                  </th>
                  <th className="border px-4 py-2 text-sm font-semibold text-slate-700" rowSpan={2}>Grade</th>
                  <th className="border px-4 py-2 text-sm font-semibold text-slate-700" rowSpan={2}></th>
                </tr>
                <tr className="bg-indigo-50">
                  <th className="border px-3 py-1.5 text-xs font-medium text-indigo-600" style={{ background: '#e0e7ff' }}>
                    Assignment<br/><span className="text-indigo-400">(15)</span>
                  </th>
                  <th className="border px-3 py-1.5 text-xs font-medium text-indigo-600" style={{ background: '#e0e7ff' }}>
                    Quiz<br/><span className="text-indigo-400">(15)</span>
                  </th>
                  <th className="border px-3 py-1.5 text-xs font-medium text-indigo-600" style={{ background: '#e0e7ff' }}>
                    Mid Sem<br/><span className="text-indigo-400">(20)</span>
                  </th>
                  <th className="border px-3 py-1.5 text-xs font-medium text-indigo-600" style={{ background: '#e0e7ff' }}>
                    Internal Total<br/><span className="text-indigo-400">(50)</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {studentMarks.map((mark, i) => (
                  <tr key={mark.rowId} className="border-b border-border hover:bg-slate-50 transition-colors">
                    {/* Student selector */}
                    <td className="border px-3 py-2 text-sm">
                      <select
                        value={mark.studentUserId || ''}
                        onChange={e => handleStudentSelection(i, e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="" disabled>Select student…</option>
                        {students.map(student => (
                          <option key={student.id} value={student.id}>
                            {student.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    {/* Name */}
                    <td className="border px-3 py-2 text-sm">
                      <span className="block h-8 leading-8 text-sm">{mark.studentName || '—'}</span>
                    </td>
                    {/* Assignment */}
                    <td className="border px-2 py-2" style={{ background: '#f5f3ff' }}>
                      <Input type="number" min={0} max={15}
                        value={mark.assignmentMarks}
                        onChange={e => handleMarksChange(i, 'assignmentMarks', Number(e.target.value))}
                        className="h-8 text-sm w-16"
                      />
                    </td>
                    {/* Quiz */}
                    <td className="border px-2 py-2" style={{ background: '#f5f3ff' }}>
                      <Input type="number" min={0} max={15}
                        value={mark.quizMarks}
                        onChange={e => handleMarksChange(i, 'quizMarks', Number(e.target.value))}
                        className="h-8 text-sm w-16"
                      />
                    </td>
                    {/* Mid Sem */}
                    <td className="border px-2 py-2" style={{ background: '#f5f3ff' }}>
                      <Input type="number" min={0} max={20}
                        value={mark.midSemMarks}
                        onChange={e => handleMarksChange(i, 'midSemMarks', Number(e.target.value))}
                        className="h-8 text-sm w-16"
                      />
                    </td>
                    {/* Internal total (computed) */}
                    <td className="border px-3 py-2 text-sm font-bold text-indigo-700 text-center" style={{ background: '#ede9fe' }}>
                      {mark.internalMarks}/50
                    </td>
                    {/* Sem Exam */}
                    <td className="border px-2 py-2" style={{ background: '#fffbeb' }}>
                      <Input type="number" min={0} max={50}
                        value={mark.semExamMarks}
                        onChange={e => handleMarksChange(i, 'semExamMarks', Number(e.target.value))}
                        className="h-8 text-sm w-16"
                      />
                    </td>
                    {/* Total */}
                    <td className="border px-3 py-2 text-sm font-bold text-emerald-700 text-center" style={{ background: '#ecfdf5' }}>
                      {mark.totalMarks ?? 0}/100
                    </td>
                    {/* Grade */}
                    <td className="border px-3 py-2 text-sm font-bold text-gold text-center">{mark.grade || '—'}</td>
                    {/* Remove */}
                    <td className="border px-3 py-2">
                      <button onClick={() => handleRemoveStudent(i)} className="p-1 rounded hover:bg-red-100">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={handleSaveMarks} className="bg-gold text-navy hover:bg-gold/90">
              Save Marks
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Download className="w-4 h-4" /> Print
            </Button>
          </div>
        </motion.div>
      </div>
      )}
    </DashboardLayout>
  );
};

export default TeacherReportGenerator;
