import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { FileText, Download, Eye, Calendar, User, Award, TrendingUp, BookMarked, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface FacultyReport {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size: string | null;
  file_type: string | null;
  uploaded_by: string;
  faculty_name: string;
  department: string | null;
  semester: string;
  academic_year: string;
  is_public: boolean;
  download_count: number;
  created_at: string;
  updated_at: string;
}

interface SemesterResult {
  id: string;
  semester: string;
  academic_year: string;
  sgpa: number;
  cgpa: number | null;
  total_credits: number;
}

const SEMESTER_LABELS: Record<string, string> = {
  I: '1st', II: '2nd', III: '3rd', IV: '4th',
  V: '5th', VI: '6th', VII: '7th', VIII: '8th',
};

const getGradeColor = (sgpa: number) => {
  if (sgpa >= 9.0) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
  if (sgpa >= 8.5) return { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/30' };
  if (sgpa >= 7.0) return { bg: 'bg-gold/10',         text: 'text-gold',        border: 'border-gold/30' };
  if (sgpa >= 5.0) return { bg: 'bg-orange-500/10',   text: 'text-orange-400',  border: 'border-orange-500/30' };
  return            { bg: 'bg-red-500/10',              text: 'text-red-400',     border: 'border-red-500/30' };
};

const StudentReports = () => {
  const { user, role, loading, roleLoading } = useAuth();
  const navigate = useNavigate();

  // Faculty reports state
  const [reports, setReports] = useState<FacultyReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const loadingReportsRef = useRef(loadingReports);

  // Semester results state
  const [semResults, setSemResults] = useState<SemesterResult[]>([]);
  const [semLoading, setSemLoading] = useState(true);
  const [semError, setSemError] = useState('');
  const [currentSem, setCurrentSem] = useState<string | null>(null);

  useEffect(() => {
    loadingReportsRef.current = loadingReports;
  }, [loadingReports]);

  useEffect(() => {
    if (!loading && !roleLoading) {
      if (!user) {
        navigate('/auth');
      } else if (role && role !== 'student') {
        navigate('/dashboard');
      } else if (role === null) {
        setLoadingReports(false);
        setReportError('Your account role could not be determined. Please contact support or try again later.');
      }
    }
  }, [user, role, loading, roleLoading, navigate]);

  useEffect(() => {
    if (user && role === 'student') {
      fetchReports();
      fetchSemesterResults();

      // Safety timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        if (loadingReportsRef.current) {
          setLoadingReports(false);
          toast.error('Loading reports timed out. Please refresh the page.');
        }
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [user, role]);

  const fetchReports = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('faculty_reports')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reports:', error);
        setReports([]);
      } else {
        setReports(data || []);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  const fetchSemesterResults = async () => {
    if (!user) return;
    setSemLoading(true);
    try {
      // Get enrollment number & current semester from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('enrollment_number, semester')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.semester) setCurrentSem(profile.semester);

      const studentId = profile?.enrollment_number ?? user.id;

      const { data, error } = await supabase
        .from('student_sgpa')
        .select('id, semester, academic_year, sgpa, cgpa, total_credits')
        .eq('student_id', studentId)
        .order('semester', { ascending: true });

      if (error) {
        setSemError('Could not load semester results.');
      } else if (!data || data.length === 0) {
        setSemError('No semester results published yet.');
      } else {
        setSemResults(data);
      }
    } catch {
      setSemError('Could not load semester results.');
    } finally {
      setSemLoading(false);
    }
  };

  const handleDownload = async (report: FacultyReport) => {
    try {
      toast.success(`Downloading "${report.title}"...`);

      const link = document.createElement('a');
      link.href = report.file_url;
      link.download = report.file_name || report.title;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Update download count
      await (supabase as any)
        .from('faculty_reports')
        .update({ download_count: (report.download_count || 0) + 1 })
        .eq('id', report.id);

    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    }
  };

  const handleView = (report: FacultyReport) => {
    window.open(report.file_url, '_blank');
  };

  if (loading || roleLoading || loadingReports) {
    return (
      <DashboardLayout activeItem="Student Reports">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-gold border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (reportError) {
    return (
      <DashboardLayout activeItem="Student Reports">
        <div className="text-center py-20">
          <p className="text-lg font-semibold text-foreground mb-2">Unable to load reports</p>
          <p className="text-muted-foreground mb-6">{reportError}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeItem="Student Reports">
      <div className="space-y-8">

        {/* ── Page Title ── */}
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">My Reports</h1>
          <p className="text-muted-foreground">View semester results and download faculty reports</p>
        </div>

        {/* ── All Semester Results ── */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <Award className="w-5 h-5 text-gold" />
            <h2 className="text-lg font-semibold text-foreground">All Semester Results</h2>
            {currentSem && (
              <span className="ml-auto text-xs bg-gold/10 text-gold border border-gold/30 rounded-full px-3 py-1 font-medium">
                Current Semester: {currentSem}
              </span>
            )}
          </div>

          {semLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-7 h-7 border-2 border-gold border-t-transparent rounded-full" />
            </div>
          ) : semResults.length === 0 ? (
            <div className="bg-card rounded-xl p-8 shadow-soft flex flex-col items-center gap-3 text-center border border-dashed border-border">
              <AlertCircle className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">{semError || 'No results available yet.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {semResults.map((res, idx) => {
                const colors = getGradeColor(res.sgpa);
                const semLabel = SEMESTER_LABELS[res.semester] ?? res.semester;
                return (
                  <motion.div
                    key={res.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 * idx }}
                    className={`bg-card rounded-xl p-5 shadow-soft border ${colors.border} relative overflow-hidden`}
                  >
                    {/* Semester badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                        Semester {res.semester}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        {semLabel} Sem
                      </span>
                    </div>

                    {/* SGPA */}
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> SGPA
                      </p>
                      <p className={`text-4xl font-serif font-bold ${colors.text}`}>
                        {res.sgpa.toFixed(2)}
                      </p>
                    </div>

                    {/* CGPA & credits */}
                    <div className="flex justify-between items-center border-t border-border/50 pt-3 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">CGPA</p>
                        <p className="text-sm font-bold text-foreground">
                          {res.cgpa != null ? res.cgpa.toFixed(2) : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <BookMarked className="w-3 h-3" /> Credits
                        </p>
                        <p className="text-sm font-bold text-foreground">{res.total_credits}</p>
                      </div>
                    </div>

                    {/* Academic year */}
                    <p className="text-xs text-muted-foreground/60 mt-2">{res.academic_year}</p>

                    {/* Subtle bg accent */}
                    <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full ${colors.bg} opacity-40`} />
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Faculty Reports ── */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <FileText className="w-5 h-5 text-gold" />
            <h2 className="text-lg font-semibold text-foreground">Faculty Reports</h2>
          </div>

          {reports.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
              <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No reports available</h3>
              <p className="text-muted-foreground">Reports will appear here once your faculty uploads them</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {reports.map((report, i) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-card rounded-xl p-6 shadow-soft border border-border/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg bg-gold/10 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-gold" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground text-lg">{report.title}</h3>
                          <p className="text-sm text-muted-foreground">{report.description || 'No description provided'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="w-4 h-4" />
                          <span>{report.faculty_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {report.created_at
                              ? new Date(report.created_at).toLocaleDateString()
                              : 'Unknown date'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="w-4 h-4" />
                          <span>{report.file_size || 'Unknown size'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-2 py-1 bg-muted rounded-full">Semester {report.semester}</span>
                        <span className="px-2 py-1 bg-muted rounded-full">{report.academic_year}</span>
                        {report.department && (
                          <span className="px-2 py-1 bg-muted rounded-full">{report.department}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleView(report)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        title="View Report"
                      >
                        <Eye className="w-5 h-5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDownload(report)}
                        className="p-2 rounded-lg bg-gold/10 hover:bg-gold/20 transition-colors"
                        title="Download Report"
                      >
                        <Download className="w-5 h-5 text-gold" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

      </div>
    </DashboardLayout>
  );
};

export default StudentReports;