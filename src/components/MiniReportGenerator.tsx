import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Download, Printer } from 'lucide-react';

interface MiniReportGeneratorProps {
  title?: string;
  description?: string;
  onGenerateReport?: (marks: { mid: number; assignment: number; quiz: number; final: number }) => void;
}

interface ReportResult {
  total: number;
  percentage: number;
  grade: string;
  remark: string;
}

export const MiniReportGenerator = ({
  title = 'Quick Report Generator',
  description = 'Generate your performance report instantly',
  onGenerateReport
}: MiniReportGeneratorProps) => {
  const [midSem, setMidSem] = useState(0);
  const [assignment, setAssignment] = useState(0);
  const [quiz, setQuiz] = useState(0);
  const [final, setFinal] = useState(0);
  const [result, setResult] = useState<ReportResult | null>(null);

  const calculateReport = () => {
    const weights = { mid: 0.2, assignment: 0.25, quiz: 0.1, final: 0.45 };
    const percentage = 
      midSem * weights.mid +
      assignment * weights.assignment +
      quiz * weights.quiz +
      final * weights.final;

    let grade = 'F';
    let remark = 'Needs improvement';

    if (percentage >= 90) {
      grade = 'A+';
      remark = 'Excellent!';
    } else if (percentage >= 80) {
      grade = 'A';
      remark = 'Very Good';
    } else if (percentage >= 70) {
      grade = 'B+';
      remark = 'Good';
    } else if (percentage >= 60) {
      grade = 'B';
      remark = 'Satisfactory';
    } else if (percentage >= 50) {
      grade = 'C';
      remark = 'Pass';
    }

    const reportData = {
      total: percentage,
      percentage: Number(percentage.toFixed(1)),
      grade,
      remark
    };

    setResult(reportData);
    onGenerateReport?.({ mid: midSem, assignment, quiz, final });
  };

  const handleDownload = () => {
    if (!result) return;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Academic Report</title>
        <style>
          body { font-family: Arial; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background: #f3f4f6; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 30px; }
          .box { padding: 20px; border: 1px solid #ddd; border-radius: 8px; text-align: center; }
          .grade { font-size: 24px; font-weight: bold; color: #fbbf24; }
        </style>
      </head>
      <body>
        <div class="header"><h1>Academic Performance Report</h1></div>
        <table class="table">
          <tr><th>Component</th><th>Marks</th><th>Weight</th></tr>
          <tr><td>Mid-Semester</td><td>${midSem}</td><td>20%</td></tr>
          <tr><td>Assignments</td><td>${assignment}</td><td>25%</td></tr>
          <tr><td>Quiz</td><td>${quiz}</td><td>10%</td></tr>
          <tr><td>Final Exam</td><td>${final}</td><td>45%</td></tr>
        </table>
        <div class="summary">
          <div class="box"><strong>Total %</strong><div class="grade">${result.percentage}%</div></div>
          <div class="box"><strong>Grade</strong><div class="grade">${result.grade}</div></div>
          <div class="box"><strong>Status</strong><div class="grade">${result.remark}</div></div>
          <div class="box"><strong>Generated</strong><div>${new Date().toLocaleDateString()}</div></div>
        </div>
      </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'academic-report.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl p-6 shadow-soft border border-border"
    >
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      <div className="grid gap-3 md:grid-cols-2 mb-4">
        <div>
          <Label className="text-xs">Mid-Sem (20%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={midSem}
            onChange={(e) => setMidSem(Math.max(0, Math.min(100, Number(e.target.value))))}
            placeholder="0"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Assignment (25%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={assignment}
            onChange={(e) => setAssignment(Math.max(0, Math.min(100, Number(e.target.value))))}
            placeholder="0"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Quiz (10%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={quiz}
            onChange={(e) => setQuiz(Math.max(0, Math.min(100, Number(e.target.value))))}
            placeholder="0"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Final Exam (45%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={final}
            onChange={(e) => setFinal(Math.max(0, Math.min(100, Number(e.target.value))))}
            placeholder="0"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <Button onClick={calculateReport} className="w-full bg-gold text-navy hover:bg-gold/90 mb-3">
        Generate Report
      </Button>

      {result && (
        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-border">
          <div className="grid grid-cols-4 gap-2 text-center mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Total %</p>
              <p className="text-lg font-bold text-gold">{result.percentage}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Grade</p>
              <p className="text-lg font-bold text-gold">{result.grade}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-xs font-semibold text-foreground">{result.remark}</p>
            </div>
            <div>
              <Button onClick={handleDownload} size="sm" variant="secondary">
                <Download className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
