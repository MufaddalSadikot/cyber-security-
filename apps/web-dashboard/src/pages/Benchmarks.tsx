import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import { Card, DemoTag, Spinner } from '../components/ui';

interface Run {
  id: string;
  system: 'baseline' | 'ours';
  scenario_id: string;
  visual_context_accuracy: number;
  pii_precision: number;
  pii_recall: number;
  redaction_precision: number;
  client_cpu_pct: number;
  client_mem_mb: number;
  e2e_latency_ms: number;
  payload_bytes: number;
  privacy_exposure: number;
  sensitive_leaks: number;
  task_success: number;
}

const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export default function Benchmarks() {
  const { data, isLoading } = useQuery({ queryKey: ['benchmarks'], queryFn: () => api.get<Run[]>('/benchmarks') });

  if (isLoading || !data)
    return <div className="grid place-items-center h-64"><Spinner /></div>;

  const ours = data.filter((r) => r.system === 'ours');
  const base = data.filter((r) => r.system === 'baseline');

  const m = (rows: Run[], key: keyof Run) => avg(rows.map((r) => r[key] as number));

  const radarData = [
    { metric: 'Visual accuracy', ours: m(ours, 'visual_context_accuracy'), baseline: m(base, 'visual_context_accuracy') },
    { metric: 'PII precision', ours: m(ours, 'pii_precision'), baseline: m(base, 'pii_precision') },
    { metric: 'PII recall', ours: m(ours, 'pii_recall'), baseline: m(base, 'pii_recall') },
    { metric: 'Redaction precision', ours: m(ours, 'redaction_precision'), baseline: m(base, 'redaction_precision') },
    { metric: 'Task success', ours: m(ours, 'task_success'), baseline: m(base, 'task_success') },
  ];

  const compareData = [
    { name: 'Latency (ms)', ours: Math.round(m(ours, 'e2e_latency_ms')), baseline: Math.round(m(base, 'e2e_latency_ms')) },
    { name: 'Payload (KB)', ours: Math.round(m(ours, 'payload_bytes') / 1024), baseline: Math.round(m(base, 'payload_bytes') / 1024) },
    { name: 'Privacy exposure', ours: Math.round(m(ours, 'privacy_exposure')), baseline: Math.round(m(base, 'privacy_exposure')) },
    { name: 'Sensitive leaks', ours: Math.round(m(ours, 'sensitive_leaks')), baseline: Math.round(m(base, 'sensitive_leaks')) },
  ];

  const resourceData = ours.map((r) => ({
    scenario: r.scenario_id.replace(/_/g, ' '),
    cpu: r.client_cpu_pct,
    mem: r.client_mem_mb,
  }));

  const priorityScores = [
    { label: 'Visual-context accuracy', weight: 25, ours: m(ours, 'visual_context_accuracy'), baseline: m(base, 'visual_context_accuracy') },
    { label: 'PII precision + recall', weight: 20, ours: (m(ours, 'pii_precision') + m(ours, 'pii_recall')) / 2, baseline: (m(base, 'pii_precision') + m(base, 'pii_recall')) / 2 },
    { label: 'Redaction precision', weight: 20, ours: m(ours, 'redaction_precision'), baseline: m(base, 'redaction_precision') },
    { label: 'Client resource util.', weight: 20, ours: 100 - m(ours, 'client_cpu_pct') * 4, baseline: 100 - m(base, 'client_cpu_pct') * 4 },
    { label: 'End-to-end latency', weight: 15, ours: Math.max(0, 100 - m(ours, 'e2e_latency_ms') / 20), baseline: Math.max(0, 100 - m(base, 'e2e_latency_ms') / 20) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-50">Evaluation / Benchmarks</h1>
          <p className="text-muted text-sm">
            Baseline (raw screenshot → cloud AI) vs PVCC (local perception → sanitized context).
          </p>
        </div>
        <DemoTag />
      </div>

      <div className="rounded-lg bg-warn/10 border border-warn/30 px-4 py-2.5 text-xs text-warn">
        ⚠ All numbers below are <strong>synthetic demonstration data</strong> generated for the
        prototype. They illustrate the intended measurement methodology, not validated scientific
        results.
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-bold text-slate-100 mb-4">Quality metrics (higher is better)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#212b45" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#7c89a8', fontSize: 11 }} />
              <Radar name="PVCC" dataKey="ours" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.3} />
              <Radar name="Baseline" dataKey="baseline" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
              <Legend />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-100 mb-4">Cost metrics (lower is better)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={compareData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#212b45" />
              <XAxis dataKey="name" tick={{ fill: '#7c89a8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#7c89a8', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend />
              <Bar dataKey="baseline" name="Baseline" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ours" name="PVCC" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-100 mb-4">Client resource utilization (PVCC)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={resourceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#212b45" />
              <XAxis dataKey="scenario" tick={{ fill: '#7c89a8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#7c89a8', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend />
              <Bar dataKey="cpu" name="CPU %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="mem" name="Memory MB" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-100 mb-1">Weighted evaluation score</h2>
          <p className="text-xs text-muted mb-4">Normalized 0–100 per the official criteria weights.</p>
          <div className="space-y-3">
            {priorityScores.map((p) => (
              <div key={p.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{p.label} <span className="text-muted">({p.weight}%)</span></span>
                  <span className="text-ok font-semibold">{Math.round(p.ours)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-bg-soft overflow-hidden relative">
                  <div className="h-full rounded-full bg-danger/50 absolute" style={{ width: `${Math.min(100, Math.max(0, p.baseline))}%` }} />
                  <div className="h-full rounded-full bg-gradient-to-r from-brand to-ok absolute" style={{ width: `${Math.min(100, Math.max(0, p.ours))}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-4 text-xs">
            <span className="flex items-center gap-1.5 text-ok"><span className="h-2 w-4 rounded bg-gradient-to-r from-brand to-ok" /> PVCC</span>
            <span className="flex items-center gap-1.5 text-danger"><span className="h-2 w-4 rounded bg-danger/50" /> Baseline</span>
          </div>
        </Card>
      </div>

      {/* Raw table */}
      <Card className="!p-0 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-line label">All benchmark runs ({data.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-2 px-3">System</th>
                <th className="py-2 px-3">Scenario</th>
                <th className="py-2 px-3">Vis. acc</th>
                <th className="py-2 px-3">PII P/R</th>
                <th className="py-2 px-3">Redaction</th>
                <th className="py-2 px-3">Latency</th>
                <th className="py-2 px-3">Payload</th>
                <th className="py-2 px-3">Exposure</th>
                <th className="py-2 px-3">Leaks</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-line/40">
                  <td className="py-1.5 px-3">
                    <span className={`badge ${r.system === 'ours' ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger'}`}>
                      {r.system === 'ours' ? 'PVCC' : 'Baseline'}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 mono text-muted">{r.scenario_id}</td>
                  <td className="py-1.5 px-3 mono">{r.visual_context_accuracy}%</td>
                  <td className="py-1.5 px-3 mono">{r.pii_precision}/{r.pii_recall}</td>
                  <td className="py-1.5 px-3 mono">{r.redaction_precision}%</td>
                  <td className="py-1.5 px-3 mono">{r.e2e_latency_ms}ms</td>
                  <td className="py-1.5 px-3 mono">{(r.payload_bytes / 1024).toFixed(1)}KB</td>
                  <td className="py-1.5 px-3 mono">{r.privacy_exposure}</td>
                  <td className={`py-1.5 px-3 mono ${r.sensitive_leaks > 0 ? 'text-danger' : 'text-ok'}`}>{r.sensitive_leaks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const tooltipStyle = {
  background: '#131a2e',
  border: '1px solid #212b45',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};
