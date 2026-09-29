import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Card, DemoTag, Spinner, StageChip } from '../components/ui';

interface Task {
  id: string;
  scenario_id: string;
  instruction: string;
  stage: string;
  status: string;
  total_ms: number;
  created_at: string;
}

const STAGE_ORDER = ['QUEUED', 'PERCEIVING', 'SANITIZING', 'COMPILING', 'REASONING', 'POLICY_CHECK', 'EXECUTING', 'COMPLETED'];

export default function AgentTasks() {
  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get<Task[]>('/tasks'),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-50">Agent Tasks</h1>
          <p className="text-muted text-sm">Every task moves through the pipeline stages with per-stage latency.</p>
        </div>
        <DemoTag />
      </div>

      {/* Stage legend */}
      <Card className="!p-4">
        <div className="flex flex-wrap gap-1.5">
          {STAGE_ORDER.map((s) => (
            <StageChip key={s} stage={s as never} />
          ))}
          <StageChip stage="BLOCKED" />
        </div>
      </Card>

      {isLoading ? (
        <div className="grid place-items-center h-40"><Spinner /></div>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-line">
                  <th className="py-2.5 px-4 font-semibold">Task</th>
                  <th className="py-2.5 px-4 font-semibold">Scenario</th>
                  <th className="py-2.5 px-4 font-semibold">Stage</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold">Latency</th>
                  <th className="py-2.5 px-4 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((t) => (
                  <tr key={t.id} className="border-b border-line/50 hover:bg-bg-hover">
                    <td className="py-2.5 px-4 font-medium text-slate-200">{t.instruction}</td>
                    <td className="py-2.5 px-4 mono text-xs text-muted">{t.scenario_id}</td>
                    <td className="py-2.5 px-4"><StageChip stage={t.stage as never} /></td>
                    <td className="py-2.5 px-4">
                      <span className={`badge ${t.status === 'blocked' ? 'bg-danger/15 text-danger' : 'bg-ok/15 text-ok'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 mono text-brand-soft">{t.total_ms} ms</td>
                    <td className="py-2.5 px-4 text-xs text-muted">
                      {new Date(t.created_at).toLocaleString('en-GB')}
                    </td>
                  </tr>
                ))}
                {data?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted">
                      No tasks yet — run one in the Demo Workspace.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
