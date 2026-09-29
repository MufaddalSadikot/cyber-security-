import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Card, DemoTag, Spinner, Stat } from '../components/ui';
import { IconArrow, IconPlay } from '../components/icons';

interface Stats {
  privacy_score: number;
  tasks_completed: number;
  sensitive_blocked: number;
  avg_latency_ms: number;
  avg_context_reduction: number;
  recent_tasks: { id: string; scenario_id: string; instruction: string; status: string; total_ms: number; created_at: string }[];
  recent_events: { id: string; category: string; code: string; message: string; ok: boolean; ts: string }[];
}

const catColor: Record<string, string> = {
  PRIVACY: 'text-accent',
  AI: 'text-brand-soft',
  ACTION: 'text-warn',
  ERROR: 'text-danger',
  SYSTEM: 'text-muted',
};

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<Stats>('/dashboard/stats'),
  });

  if (isLoading || !data)
    return (
      <div className="grid place-items-center h-64">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-50">Dashboard</h1>
          <p className="text-muted text-sm">Operational overview of the privacy-aware agent system.</p>
        </div>
        <div className="flex items-center gap-3">
          <DemoTag />
          <Link to="/app/demo" className="btn-primary">
            <IconPlay /> Live Demo
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Privacy score" value={`${data.privacy_score}`} sub="blended index" accent="text-ok" />
        <Stat label="Tasks completed" value={data.tasks_completed} sub="all sessions" />
        <Stat label="Sensitive blocked" value={data.sensitive_blocked} sub="critical items" accent="text-danger" />
        <Stat label="Avg latency" value={`${data.avg_latency_ms}`} sub="ms end-to-end" accent="text-brand-soft" />
        <Stat label="Context reduction" value={`${data.avg_context_reduction}%`} sub="avg payload cut" accent="text-accent" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-100">Recent tasks</h2>
            <Link to="/app/tasks" className="text-xs text-brand-soft flex items-center gap-1">
              View all <IconArrow width={14} height={14} />
            </Link>
          </div>
          <div className="space-y-2">
            {data.recent_tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg bg-bg-soft px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">{t.instruction}</div>
                  <div className="text-[11px] text-muted">{t.scenario_id}</div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span
                    className={`badge ${
                      t.status === 'blocked'
                        ? 'bg-danger/15 text-danger'
                        : 'bg-ok/15 text-ok'
                    }`}
                  >
                    {t.status}
                  </span>
                  <div className="text-[11px] text-muted mt-0.5">{t.total_ms} ms</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-100">Recent security events</h2>
            <Link to="/app/audit" className="text-xs text-brand-soft flex items-center gap-1">
              Audit log <IconArrow width={14} height={14} />
            </Link>
          </div>
          <div className="space-y-1.5">
            {data.recent_events.map((e) => (
              <div key={e.id} className="mono text-[11px] flex items-center gap-2">
                <span className={`shrink-0 font-semibold ${catColor[e.category] ?? 'text-muted'}`}>
                  [{e.category}]
                </span>
                <span className="text-slate-300 truncate">{e.message}</span>
                <span className={`ml-auto shrink-0 ${e.ok ? 'text-ok' : 'text-danger'}`}>
                  {e.ok ? '✓' : '⛔'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
