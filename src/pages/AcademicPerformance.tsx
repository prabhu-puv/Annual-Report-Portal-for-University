import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { motion } from 'framer-motion';
import { Loader2, BookOpen, TrendingUp, Award, BarChart3, Download } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Mark {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  assignment_marks: number;
  quiz_marks: number;
  mid_sem_marks: number;
  internal_marks: number;
  external_marks: number;
  total_marks: number;
  grade: string | null;
  semester: string;
  academic_year: string;
}

interface SgpaEntry {
  semester: string;
  sgpa: number;
  academic_year: string;
}

const gradeColor: Record<string, string> = {
  'A+': 'text-emerald-600',
  'A': 'text-emerald-500',
  'B+': 'text-blue-600',
  'B': 'text-blue-500',
  'C': 'text-amber-500',
  'F': 'text-red-500',
};

// Compute grade from total marks (same logic as teacher entry form)
const calculateGrade = (total: number): string => {
  if (total >= 90) return 'A+';
  if (total >= 80) return 'A';
  if (total >= 70) return 'B+';
  if (total >= 60) return 'B';
  if (total >= 50) return 'C';
  return 'F';
};

const AcademicPerformance = () => {
  const { user, loading, role, fullName, rollNo } = useAuth();
  const navigate = useNavigate();
  const [marks, setMarks] = useState<Mark[]>([]);
  const [sgpaData, setSgpaData] = useState<SgpaEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [semesters, setSemesters] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchMarks();
      fetchSgpa();
    }
  }, [user]);

  const fetchMarks = async () => {
    try {
      // Fetch marks joined with subjects
      const { data, error } = await (supabase as any)
        .from('marks')
        .select(`
          id,
          subject_id,
          assignment_marks,
          quiz_marks,
          mid_sem_marks,
          internal_marks,
          external_marks,
          total_marks,
          grade,
          semester,
          academic_year,
          subjects (
            code,
            name
          )
        `)
        .eq('student_id', user!.id)
        .order('semester', { ascending: true });

      if (error) {
        console.error('Error fetching marks:', error);
      } else {
        const formatted: Mark[] = (data || []).map((m: any) => ({
          id: m.id,
          subject_id: m.subject_id,
          subject_name: m.subjects?.name || 'Unknown Subject',
          subject_code: m.subjects?.code || '-',
          assignment_marks: m.assignment_marks ?? 0,
          quiz_marks: m.quiz_marks ?? 0,
          mid_sem_marks: m.mid_sem_marks ?? 0,
          internal_marks: m.internal_marks,
          external_marks: m.external_marks,
          total_marks: m.total_marks,
          grade: m.grade,
          semester: m.semester,
          academic_year: m.academic_year,
        }));
        setMarks(formatted);

        // Extract unique semesters
        const uniqueSems = [...new Set(formatted.map(m => m.semester))].sort();
        setSemesters(uniqueSems);
        if (uniqueSems.length > 0) {
          setSelectedSemester(uniqueSems[uniqueSems.length - 1]); // default to latest
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchSgpa = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('student_sgpa')
        .select('semester, sgpa, academic_year')
        .eq('student_id', user!.id)
        .order('semester', { ascending: true });

      if (!error && data) {
        setSgpaData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMarks = selectedSemester === 'all'
    ? marks
    : marks.filter(m => m.semester === selectedSemester);

  const chartData = filteredMarks.map(m => ({
    subject: m.subject_code,
    Internal: m.internal_marks,
    'Sem Exam': m.external_marks,
    Total: m.total_marks,
  }));

  // Normalise SGPA to /10 scale (auto-detect old /4 data: if max sgpa <= 4, scale up)
  const normalisedSgpaData = sgpaData.map(s => ({
    ...s,
    sgpa: s.sgpa <= 4 ? Number((s.sgpa * 2.5).toFixed(2)) : s.sgpa,
  }));

  const sgpaChartData = normalisedSgpaData.map(s => ({
    sem: `Sem ${s.semester}`,
    SGPA: s.sgpa,
  }));

  const currentSgpa = normalisedSgpaData.length
    ? normalisedSgpaData[normalisedSgpaData.length - 1].sgpa.toFixed(2)
    : 'N/A';

  const avgTotal = filteredMarks.length
    ? Math.round(filteredMarks.reduce((acc, m) => acc + m.total_marks, 0) / filteredMarks.length)
    : 0;

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    const semLabel = selectedSemester === 'all' ? 'All Semesters' : `Semester ${selectedSemester}`;
    const pageWidth = doc.internal.pageSize.getWidth();

    const renderDoc = (logoObj: HTMLImageElement | null) => {
      // ── Header Banner ───────────────────────────────────────
      doc.setFillColor(15, 23, 42); // Dark Navy
      doc.rect(0, 0, pageWidth, 28, 'F');
      doc.setFillColor(212, 175, 55); // Metallic Gold
      doc.rect(0, 28, pageWidth, 2, 'F');

      let textStartX = 14;
      
      if (logoObj) {
        doc.addImage(logoObj, 'PNG', 14, 4, 20, 20);
        textStartX = 38;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text('ALLIANCE UNIVERSITY', textStartX, 19);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`OFFICIAL TRANSCRIPT`, pageWidth - 14, 15, { align: 'right' });
      doc.text(`DATE: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}`, pageWidth - 14, 21, { align: 'right' });

      // ── Document Title ──────────────────────────────────────
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('ACADEMIC PERFORMANCE STATEMENT', pageWidth / 2, 40, { align: 'center' });

      // ── Student Info Box ────────────────────────────────────
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(14, 46, pageWidth - 28, 24, 2, 2, 'FD');

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'bold');
      doc.text('STUDENT NAME:', 18, 54);
      doc.text('ROLL NO:', 18, 60);
      doc.text('ACADEMIC YEAR:', 18, 66);
      
      doc.text('REPORTING PERIOD:', 150, 54);
      doc.text('CUMULATIVE SGPA:', 150, 60);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text((fullName || '').toUpperCase(), 54, 54);
      doc.text(rollNo || 'N/A', 54, 60);
      doc.text('2025-2026', 54, 66);
      
      doc.text(semLabel, 192, 54);
      doc.text(`${currentSgpa} / 10.00`, 192, 60);

      // ── Table ───────────────────────────────────────────────
      autoTable(doc, {
        startY: 76,
        head: [
          [
            { content: 'Code',         rowSpan: 2, styles: { valign: 'middle', fillColor: [10, 30, 70], textColor: 255 } },
            { content: 'Subject',      rowSpan: 2, styles: { valign: 'middle', fillColor: [10, 30, 70], textColor: 255 } },
            { content: 'Internal Marks (50)', colSpan: 4, styles: { halign: 'center', fillColor: [99, 102, 241], textColor: 255 } },
            { content: 'Sem Exam (50)', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fillColor: [245, 158, 11], textColor: 255 } },
            { content: 'Total (100)',  rowSpan: 2, styles: { valign: 'middle', halign: 'center', fillColor: [16, 185, 129], textColor: 255 } },
            { content: 'Grade',        rowSpan: 2, styles: { valign: 'middle', halign: 'center', fillColor: [10, 30, 70], textColor: 255 } },
          ],
          [
            { content: 'Assignment\n(15)', styles: { halign: 'center', fillColor: [129, 140, 248], textColor: 255, fontSize: 8 } },
            { content: 'Quiz\n(15)',       styles: { halign: 'center', fillColor: [129, 140, 248], textColor: 255, fontSize: 8 } },
            { content: 'Mid Sem\n(20)',    styles: { halign: 'center', fillColor: [129, 140, 248], textColor: 255, fontSize: 8 } },
            { content: 'Total\n(50)',      styles: { halign: 'center', fillColor: [99, 102, 241],  textColor: 255, fontSize: 8, fontStyle: 'bold' } },
          ],
        ],
        body: filteredMarks.map((mark, idx) => [
          mark.subject_code,
          mark.subject_name,
          mark.assignment_marks,
          mark.quiz_marks,
          mark.mid_sem_marks,
          `${mark.internal_marks}/50`,
          mark.external_marks,
          mark.total_marks,
          calculateGrade(mark.total_marks),
        ]),
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 22 },
          1: { cellWidth: 52 },
          2: { halign: 'center', cellWidth: 24 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 22 },
          5: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
          6: { halign: 'center', cellWidth: 24 },
          7: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
          8: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
        },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        didParseCell(data) {
          // colour grade cells
          if (data.section === 'body' && data.column.index === 8) {
            const g = String(data.cell.raw);
            const colours: Record<string, [number,number,number]> = {
              'A+': [16,185,129], 'A': [52,211,153],
              'B+': [99,102,241], 'B': [129,140,248],
              'C':  [245,158,11], 'F': [239,68,68],
            };
            if (colours[g]) { data.cell.styles.fillColor = colours[g]; data.cell.styles.textColor = 255; }
          }
        },
      });

      // ── Footer ──────────────────────────────────────────────
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}  |  Alliance University Official Portal`, 148, doc.internal.pageSize.height - 6, { align: 'center' });
      }

      doc.save(`MarkSheet_${selectedSemester}_${new Date().toISOString().slice(0,10)}.pdf`);
    };

    const imgPath = '/alliance-logo.png';
    const img = new Image();
    img.src = imgPath;
    img.onload = () => renderDoc(img);
    img.onerror = () => renderDoc(null);
  };

  if (loading) return null;

  return (
    <DashboardLayout activeItem="Academic Performance">
      <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Academic Performance</h1>
      <p className="text-muted-foreground mb-6">View your marks, grades, and SGPA entered by your faculty</p>

      {loadingData ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      ) : marks.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border">
          <BookOpen className="w-14 h-14 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Marks Available</h3>
          <p className="text-muted-foreground text-sm">
            Your marks will appear here once your teacher enters them via the Marks Entry portal.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Subjects', value: filteredMarks.length, icon: BookOpen, color: 'text-blue-600' },
              { label: 'Avg Total', value: `${avgTotal}/100`, icon: BarChart3, color: 'text-gold' },
              { label: 'Current SGPA', value: `${currentSgpa}/10`, icon: TrendingUp, color: 'text-emerald-600' },
              { label: 'Semesters', value: semesters.length, icon: Award, color: 'text-purple-500' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="bg-card rounded-xl p-4 shadow-soft"
              >
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
                <p className="text-2xl font-bold font-serif text-foreground">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Semester Filter */}
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm text-muted-foreground font-medium">Filter by Semester:</label>
            <Select value={selectedSemester} onValueChange={setSelectedSemester}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                {semesters.map(sem => (
                  <SelectItem key={sem} value={sem}>Semester {sem}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Bar Chart — Internal vs External vs Total */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-foreground mb-4">Subject-wise Marks</h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Internal" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Sem Exam" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Total" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-10">No data for this semester</p>
              )}
            </motion.div>

            {/* SGPA Trend */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-foreground mb-4">SGPA Trend</h2>
              {sgpaChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={sgpaChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sem" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="SGPA" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-10">SGPA data will appear once marks are entered</p>
              )}
            </motion.div>
          </div>

          {/* Detailed Marks Table */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl shadow-soft overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Detailed Mark Sheet</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedSemester === 'all' ? 'All semesters' : `Semester ${selectedSemester}`}
                </p>
              </div>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 px-4 py-2 bg-gold text-navy font-semibold rounded-lg hover:bg-gold/90 transition-colors shadow-sm text-sm"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  {/* Row 1: group headers */}
                  <tr className="bg-muted/50 text-left">
                    <th className="px-5 py-3 font-medium text-muted-foreground" rowSpan={2}>Subject Code</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground" rowSpan={2}>Subject Name</th>
                    <th className="px-3 py-2 font-semibold text-indigo-700 text-center bg-indigo-50" colSpan={4}>
                      Internal Marks (50)
                    </th>
                    <th className="px-5 py-3 font-medium text-amber-700 text-center bg-amber-50" rowSpan={2}>
                      Sem Exam<br/><span className="font-normal text-xs">(50)</span>
                    </th>
                    <th className="px-5 py-3 font-medium text-emerald-700 text-center bg-emerald-50" rowSpan={2}>
                      Total<br/><span className="font-normal text-xs">(100)</span>
                    </th>
                    <th className="px-5 py-3 font-medium text-muted-foreground text-center" rowSpan={2}>Grade</th>
                    <th className="px-5 py-3 font-medium text-muted-foreground" rowSpan={2}>Semester</th>
                  </tr>
                  {/* Row 2: internal sub-columns */}
                  <tr className="bg-indigo-50">
                    <th className="px-3 py-1.5 text-xs font-medium text-indigo-600 text-center border-t border-indigo-100">
                      Assignment<br/><span className="text-indigo-400">(15)</span>
                    </th>
                    <th className="px-3 py-1.5 text-xs font-medium text-indigo-600 text-center border-t border-indigo-100">
                      Quiz<br/><span className="text-indigo-400">(15)</span>
                    </th>
                    <th className="px-3 py-1.5 text-xs font-medium text-indigo-600 text-center border-t border-indigo-100">
                      Mid Sem<br/><span className="text-indigo-400">(20)</span>
                    </th>
                    <th className="px-3 py-1.5 text-xs font-semibold text-indigo-700 text-center border-t border-indigo-100">
                      Total<br/><span className="text-indigo-500">(50)</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMarks.map((mark, i) => (
                    <motion.tr
                      key={mark.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-t border-border hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-5 py-3 font-medium text-foreground">{mark.subject_code}</td>
                      <td className="px-5 py-3 text-foreground">{mark.subject_name}</td>
                      {/* Assignment */}
                      <td className="px-3 py-3 text-center" style={{ background: '#f5f3ff' }}>
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">
                          {mark.assignment_marks}
                        </span>
                      </td>
                      {/* Quiz */}
                      <td className="px-3 py-3 text-center" style={{ background: '#f5f3ff' }}>
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">
                          {mark.quiz_marks}
                        </span>
                      </td>
                      {/* Mid Sem */}
                      <td className="px-3 py-3 text-center" style={{ background: '#f5f3ff' }}>
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">
                          {mark.mid_sem_marks}
                        </span>
                      </td>
                      {/* Internal Total */}
                      <td className="px-3 py-3 text-center" style={{ background: '#ede9fe' }}>
                        <span className="px-2 py-1 bg-indigo-200 text-indigo-800 rounded text-xs font-bold">
                          {mark.internal_marks}/50
                        </span>
                      </td>
                      {/* Sem Exam */}
                      <td className="px-5 py-3 text-center">
                        <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-semibold">
                          {mark.external_marks}
                        </span>
                      </td>
                      {/* Total */}
                      <td className="px-5 py-3 text-center">
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-semibold">
                          {mark.total_marks}
                        </span>
                      </td>
                      {/* Grade */}
                      <td className="px-5 py-3 text-center">
                        <span className={`font-bold text-base ${gradeColor[calculateGrade(mark.total_marks)] || 'text-foreground'}`}>
                          {calculateGrade(mark.total_marks)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">Sem {mark.semester}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </DashboardLayout>
  );
};

export default AcademicPerformance;
