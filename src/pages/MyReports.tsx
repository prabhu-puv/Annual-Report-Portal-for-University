import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { FileText, Download, Eye, Plus, Loader2, Users, Search, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';;
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  created_at: string;
  updated_at: string;
  semester: string;
  academic_year: string;
  is_public: boolean;
  download_count: number;
}

interface StudentProfile {
  user_id: string;
  full_name: string | null;
  enrollment_number: string | null;
  semester: string | null;
  department: string | null;
  email: string | null;
}

const SEMESTERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const MyReports = () => {
  const { user, role, loading, roleLoading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<FacultyReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    semester: 'I',
    academicYear: '2024-25',
    isPublic: true,
  });
  const [file, setFile] = useState<File | null>(null);

  // Semester I students state
  const [sem1Students, setSem1Students] = useState<StudentProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentList, setShowStudentList] = useState(false);

  useEffect(() => {
    if (!loading && !roleLoading) {
      if (!user) {
        navigate('/auth');
      } else if (role === 'student') {
        navigate('/dashboard');
      } else if (role === 'teacher' || role === 'admin') {
        fetchReports();
        fetchSem1Students();
      }
    }
  }, [user, role, loading, roleLoading, navigate]);

  const fetchReports = async () => {
    if (!user) return;
    try {
      setIsLoadingReports(true);
      const { data, error } = await (supabase as any)
        .from('faculty_reports')
        .select('*')
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reports:', error);
        toast.error('Failed to load reports');
      } else {
        setReports(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const fetchSem1Students = async () => {
    setStudentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, enrollment_number, semester, department, email')
        .eq('semester', 'I')
        .order('full_name', { ascending: true });

      if (!error && data) {
        setSem1Students(data as StudentProfile[]);
      }
    } catch (e) {
      console.error('Error fetching semester 1 students:', e);
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!form.title || !file) {
      toast.error('Please provide a title and select a file');
      return;
    }
    if (!user) return;

    try {
      setUploading(true);
      const BUCKET = 'faculty-reports';
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          toast.error('Storage bucket not ready. Please create a bucket named "faculty-reports" (Public) in your Supabase Dashboard → Storage.');
          return;
        }
        console.error('Upload Error:', uploadError);
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(filePath);

      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      const fileSizeStr = `${sizeInMB} MB`;

      const { error: dbError } = await (supabase as any).from('faculty_reports').insert({
        title: form.title,
        description: form.description,
        file_url: publicUrlData.publicUrl,
        file_name: file.name,
        file_size: fileSizeStr,
        file_type: file.type || 'application/octet-stream',
        semester: form.semester,
        academic_year: form.academicYear,
        uploaded_by: user.id,
        faculty_name: user.user_metadata?.full_name || 'Faculty Member',
        is_public: form.isPublic,
      });

      if (dbError) {
        console.error('DB Insert Error:', dbError);
        throw dbError;
      }

      toast.success('Report uploaded successfully!');
      setUploadOpen(false);
      setForm({ title: '', description: '', semester: 'I', academicYear: '2024-25', isPublic: true });
      setFile(null);
      fetchReports();
    } catch (error: any) {
      console.error('Error in upload process:', error);
      toast.error(error.message || 'Failed to upload report');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (report: FacultyReport) => {
    toast.success(`Preparing "${report.title}" for download...`);
    window.open(report.file_url, '_blank');
  };

  const togglePublicStatus = async (reportId: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('faculty_reports')
        .update({ is_public: !currentStatus })
        .eq('id', reportId);
      if (error) throw error;
      toast.success(currentStatus ? 'Report made private' : 'Report made public');
      fetchReports();
    } catch (e) {
      console.error(e);
      toast.error('Failed to change report visibility');
    }
  };

  if (loading || roleLoading) return null;

  const filteredStudents = sem1Students.filter((s) => {
    const q = studentSearch.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.enrollment_number?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout activeItem="Upload Reports">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">My Reports</h1>
          <p className="text-muted-foreground">Manage your uploaded departmental and student reports.</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="bg-gold text-navy hover:bg-gold/90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Upload Report
        </Button>
      </div>

      {/* ── Semester I Students Panel ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl shadow-soft border border-border/60 mb-8 overflow-hidden"
      >
        {/* Panel header */}
        <button
          className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
          onClick={() => setShowStudentList((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-gold" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Semester I Students</p>
              <p className="text-xs text-muted-foreground">
                {studentsLoading ? 'Loading…' : `${sem1Students.length} students enrolled`}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${showStudentList ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Collapsible student list */}
        {showStudentList && (
          <div className="border-t border-border/60">
            {/* Search */}
            <div className="p-4 border-b border-border/40">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, enrollment no. or email…"
                  className="pl-9"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
              {studentsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-gold" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {studentSearch ? 'No students match your search.' : 'No Semester I students found.'}
                </div>
              ) : (
                filteredStudents.map((s, idx) => (
                  <motion.div
                    key={s.user_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Avatar initials */}
                    <div className="w-9 h-9 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-gold">
                        {s.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '??'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.full_name ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                        {s.enrollment_number ?? '—'}
                      </span>
                      {s.department && (
                        <p className="text-xs text-muted-foreground mt-0.5">{s.department}</p>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer count */}
            {!studentsLoading && filteredStudents.length > 0 && (
              <div className="px-5 py-3 border-t border-border/40 text-xs text-muted-foreground">
                Showing {filteredStudents.length} of {sem1Students.length} Semester I students
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Upload Dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload New Report</DialogTitle>
            <DialogDescription>
              Upload a document that students can access and download from their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-1 block">Report Title</Label>
              <Input
                placeholder="e.g. Computer Networks Semester Report"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1 block">Description</Label>
              <Input
                placeholder="Brief description about the report..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Semester</Label>
                <select
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {SEMESTERS.map((s) => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-1 block">Academic Year</Label>
                <Input
                  value={form.academicYear}
                  onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">File</Label>
              <Input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={form.isPublic}
                onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                className="rounded border-gray-300 text-gold focus:ring-gold"
              />
              <Label htmlFor="isPublic" className="font-normal cursor-pointer">
                Publish immediately (students can view and download)
              </Label>
            </div>
          </div>

          {/* Sem I student preview in modal */}
          {form.semester === 'I' && sem1Students.length > 0 && (
            <div className="border border-gold/30 rounded-lg p-3 bg-gold/5 mb-2">
              <p className="text-xs font-semibold text-gold mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" /> Semester I recipients ({sem1Students.length} students)
              </p>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {sem1Students.slice(0, 5).map((s) => (
                  <p key={s.user_id} className="text-xs text-muted-foreground truncate">
                    {s.full_name} · {s.enrollment_number}
                  </p>
                ))}
                {sem1Students.length > 5 && (
                  <p className="text-xs text-gold">+{sem1Students.length - 5} more students…</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading} className="bg-gold text-navy hover:bg-gold/90 w-24">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reports List ── */}
      <div className="space-y-4">
        {isLoadingReports ? (
          <div className="text-center py-12 text-muted-foreground flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
            <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">No reports uploaded</h3>
            <p className="text-sm text-muted-foreground mb-4">You haven't uploaded any reports yet.</p>
            <Button onClick={() => setUploadOpen(true)} variant="outline">
              Upload First Report
            </Button>
          </div>
        ) : (
          reports.map((report, i) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card rounded-xl p-5 shadow-soft flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg">{report.title}</h3>
                  <p className="text-sm text-muted-foreground mb-1">
                    {report.description || 'No description provided'}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="bg-muted px-2 py-0.5 rounded">Sem {report.semester}</span>
                    <span className="bg-muted px-2 py-0.5 rounded">{report.academic_year}</span>
                    <span>{report.file_size}</span>
                    <span>{report.created_at ? new Date(report.created_at).toLocaleDateString() : 'Unknown date'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 self-end md:self-auto">
                <button
                  onClick={() => togglePublicStatus(report.id, report.is_public)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    report.is_public
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
                      : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
                  }`}
                  title="Click to toggle visibility"
                >
                  {report.is_public ? 'Published' : 'Draft'}
                </button>
                <button onClick={() => window.open(report.file_url, '_blank')} className="p-2 rounded-lg hover:bg-muted transition-colors" title="View">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={() => handleDownload(report)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Download">
                  <Download className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyReports;
