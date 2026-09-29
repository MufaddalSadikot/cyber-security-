import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Card, DemoTag, Spinner } from '../components/ui';
import clsx from 'clsx';

interface Event {
  id: string;
  task_id: string | null;
  ts: string;
  category: string;
  code: string;
  message: string;
  ok: boolean;
}

const FILTERS = ['All', 'PRIVACY', 'AI', 'ACTION', 'ERROR'];

const catColor: Record<string, string> = {
  PRIVACY: 'bg-accent/15 text-accent',
  AI: 'bg-brand/15 text-brand-soft',
  ACTION: 'bg-warn/15 text-warn',
  ERROR: 'bg-danger/15 text-danger',
  SYSTEM: 'bg-slate-500/15 text-slate-400',
};

export default function AuditLog() {
  const [filter, setFilter] = useState('All');
  const { data, isLoading } = useQuery({
    queryKey: ['audit', filter],
    queryFn: () => api.get<Event[]>(`/audit-events?category=${filter}&limit=300`),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-50">Audit Log</h1>
          <p className="text-muted text-sm">Every agent operation generates a structured, filterable audit event.</p>
        </div>
        <DemoTag />
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'badge border px-3 py-1',
              filter === f ? 'border-brand text-brand-soft bg-brand/10' : 'border-line text-muted hover:text-slate-200',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center h-40"><Spinner /></div>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="divide-y divide-line/40 max-h-[70vh] overflow-y-auto">
            {data?.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover">
                <span className="mono text-[11px] text-muted shrink-0 w-20">
                  {new Date(e.ts).toLocaleTimeString('en-GB', { hour12: false })}
                </span>
                <span className={clsx('badge shrink-0 w-20 justify-center', catColor[e.category])}>
                  {e.category}
                </span>
                <span className="mono text-[11px] text-slate-400 shrink-0 w-40 truncate">{e.code}</span>
                <span className="text-sm text-slate-300 flex-1 truncate">{e.message}</span>
                <span className={clsx('shrink-0', e.ok ? 'text-ok' : 'text-danger')}>{e.ok ? '✓' : '⛔'}</span>
              </div>
            ))}
            {data?.length === 0 && <div className="py-8 text-center text-muted">No events for this filter.</div>}
          </div>
        </Card>
      )}
    </div>
  );
}
