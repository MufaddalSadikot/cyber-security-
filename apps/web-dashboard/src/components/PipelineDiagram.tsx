import clsx from 'clsx';

const STEPS = [
  { label: 'Raw Webpage', tone: 'danger', local: true },
  { label: 'Local Perception', tone: 'brand', local: true },
  { label: 'Local Privacy Engine', tone: 'accent', local: true },
  { label: 'Task-Aware Compiler', tone: 'accent', local: true },
  { label: 'Sanitized Context', tone: 'ok', local: true },
  { label: 'Remote AI Reasoning', tone: 'brand', local: false },
  { label: 'Action Policy', tone: 'warn', local: true },
  { label: 'Browser Execution', tone: 'ok', local: true },
];

const toneMap: Record<string, string> = {
  danger: 'border-danger/40 text-danger bg-danger/5',
  brand: 'border-brand/40 text-brand-soft bg-brand/5',
  accent: 'border-accent/40 text-accent bg-accent/5',
  ok: 'border-ok/40 text-ok bg-ok/5',
  warn: 'border-warn/40 text-warn bg-warn/5',
};

export default function PipelineDiagram({
  activeIndex,
  compact,
}: {
  activeIndex?: number;
  compact?: boolean;
}) {
  return (
    <div className={clsx('flex flex-col gap-2', compact && 'text-xs')}>
      {STEPS.map((s, i) => (
        <div key={s.label}>
          <div
            className={clsx(
              'rounded-lg border px-3 py-2 flex items-center justify-between transition-all',
              toneMap[s.tone],
              activeIndex === i && 'shadow-glow scale-[1.02]',
              activeIndex !== undefined && activeIndex > i && 'opacity-60',
            )}
          >
            <span className="font-semibold">{s.label}</span>
            <span
              className={clsx(
                'badge text-[10px]',
                s.local ? 'bg-ok/10 text-ok' : 'bg-brand/10 text-brand-soft',
              )}
            >
              {s.local ? 'ON DEVICE' : 'SERVER'}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="flex justify-center py-0.5">
              <div
                className={clsx(
                  'h-3 w-px',
                  activeIndex !== undefined && activeIndex > i ? 'bg-ok' : 'bg-line',
                )}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
