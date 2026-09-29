import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { PolicyDecisionType, Sensitivity, TaskStage } from '@pvcc/shared';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('card p-5', className)}>{children}</div>;
}

export function SectionTitle({
  title,
  subtitle,
  icon,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3">
        {icon && <div className="text-brand mt-0.5">{icon}</div>}
        <div>
          <h2 className="text-lg font-bold text-slate-100 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

const sensStyles: Record<Sensitivity, string> = {
  CRITICAL: 'bg-danger/15 text-danger border border-danger/30',
  HIGH: 'bg-warn/15 text-warn border border-warn/30',
  MEDIUM: 'bg-brand/15 text-brand-soft border border-brand/30',
  LOW: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
};

export function SensitivityBadge({ level }: { level: Sensitivity }) {
  return <span className={clsx('badge', sensStyles[level])}>{level}</span>;
}

const decisionStyles: Record<PolicyDecisionType, string> = {
  ALLOW: 'bg-ok/15 text-ok border border-ok/30',
  CONFIRM: 'bg-warn/15 text-warn border border-warn/30',
  BLOCK: 'bg-danger/15 text-danger border border-danger/30',
};

export function DecisionBadge({ decision }: { decision: PolicyDecisionType }) {
  const icon = decision === 'ALLOW' ? '✓' : decision === 'BLOCK' ? '⛔' : '⚠';
  return (
    <span className={clsx('badge px-2.5 py-1', decisionStyles[decision])}>
      {icon} {decision}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <span className={clsx('text-3xl font-extrabold', accent ?? 'text-slate-100')}>{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </Card>
  );
}

const stageColors: Record<string, string> = {
  QUEUED: 'text-muted',
  PERCEIVING: 'text-brand-soft',
  SANITIZING: 'text-accent',
  COMPILING: 'text-accent',
  REASONING: 'text-brand',
  POLICY_CHECK: 'text-warn',
  EXECUTING: 'text-ok',
  COMPLETED: 'text-ok',
  BLOCKED: 'text-danger',
};

export function StageChip({ stage, active }: { stage: TaskStage; active?: boolean }) {
  return (
    <span
      className={clsx(
        'badge border',
        active ? 'border-current animate-pulseline' : 'border-line',
        stageColors[stage] ?? 'text-muted',
      )}
    >
      {stage.replace('_', ' ')}
    </span>
  );
}

export function DemoTag() {
  return (
    <span className="badge bg-warn/10 text-warn border border-warn/30" title="Synthetic demonstration data">
      DEMO / SYNTHETIC
    </span>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
  );
}
