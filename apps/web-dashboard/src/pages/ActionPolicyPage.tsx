import { useMemo, useState } from 'react';
import { ActionPolicyEngine } from '@pvcc/action-policy';
import { PrivacyEngine } from '@pvcc/privacy-engine';
import { getScenario } from '@pvcc/shared';
import type { ActionType } from '@pvcc/shared';
import { Card, DecisionBadge, DemoTag } from '../components/ui';
import { IconGavel } from '../components/icons';

const policy = new ActionPolicyEngine();
const privacy = new PrivacyEngine();

const ACTION_TYPES: ActionType[] = [
  'CLICK',
  'SCROLL',
  'NAVIGATE',
  'SELECT',
  'FILL',
  'SUBMIT',
  'PURCHASE',
  'REVEAL_CREDENTIAL',
  'DOWNLOAD',
];

const catalogue = ActionPolicyEngine.catalogue();

export default function ActionPolicyPage() {
  const [actionType, setActionType] = useState<ActionType>('CLICK');
  const [targetLabel, setTargetLabel] = useState('Order details');
  const scenario = getScenario('bank_otp')!;

  const decision = useMemo(() => {
    const rawText = scenario.elements.map((e) => e.text).join('\n');
    const { entities } = privacy.analyze({ text: rawText, elements: scenario.elements });
    const otpEl = scenario.elements.find((e) => e.id === 'in-otp');
    const targetId =
      actionType === 'REVEAL_CREDENTIAL' || actionType === 'FILL' ? otpEl?.id : undefined;
    return policy.evaluate(
      { type: actionType, targetId, targetLabel, rationale: 'interactive test' },
      { entities, elements: scenario.elements },
    );
  }, [actionType, targetLabel, scenario]);

  const grouped = {
    ALLOW: catalogue.filter((c) => c.decision === 'ALLOW'),
    CONFIRM: catalogue.filter((c) => c.decision === 'CONFIRM'),
    BLOCK: catalogue.filter((c) => c.decision === 'BLOCK'),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-50">Action Policy Engine</h1>
          <p className="text-muted text-sm">
            The remote AI can only <span className="text-slate-200 font-semibold">propose</span>.
            Every action is evaluated locally before execution.
          </p>
        </div>
        <DemoTag />
      </div>

      {/* Interactive tester */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-brand"><IconGavel /></span>
          <h2 className="font-bold text-slate-100">Policy simulator</h2>
          <span className="badge bg-danger/10 text-danger text-xs ml-auto">context: bank OTP page</span>
        </div>
        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="label block mb-1.5">AI-proposed action</label>
            <select className="input" value={actionType} onChange={(e) => setActionType(e.target.value as ActionType)}>
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label block mb-1.5">Target label</label>
            <input className="input" value={targetLabel} onChange={(e) => setTargetLabel(e.target.value)} />
          </div>
          <div className="pb-1">
            <DecisionBadge decision={decision.decision} />
          </div>
        </div>

        {/* Decision flow */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
          <FlowNode label="AI REQUEST" sub={actionType} tone="brand" />
          <Arrow />
          <FlowNode label="LOCAL POLICY CHECK" sub={decision.rule} tone="warn" />
          <Arrow />
          <FlowNode
            label={decision.decision}
            sub={decision.decision === 'BLOCK' ? 'not executed' : decision.decision === 'CONFIRM' ? 'awaits human' : 'executed'}
            tone={decision.decision === 'ALLOW' ? 'ok' : decision.decision === 'BLOCK' ? 'danger' : 'warn'}
          />
        </div>
        <div className="mt-4 rounded-lg bg-bg-soft p-3 text-sm text-slate-300">
          <span className="mono text-xs text-muted">{decision.rule}</span>
          <p className="mt-1">{decision.reason}</p>
        </div>
      </Card>

      {/* Catalogue */}
      <div className="grid lg:grid-cols-3 gap-4">
        <PolicyColumn title="Allow" tone="ok" rules={grouped.ALLOW} />
        <PolicyColumn title="Require confirmation" tone="warn" rules={grouped.CONFIRM} />
        <PolicyColumn title="Block" tone="danger" rules={grouped.BLOCK} />
      </div>
    </div>
  );
}

function FlowNode({ label, sub, tone }: { label: string; sub: string; tone: string }) {
  const map: Record<string, string> = {
    brand: 'border-brand/40 text-brand-soft',
    warn: 'border-warn/40 text-warn',
    ok: 'border-ok/40 text-ok',
    danger: 'border-danger/40 text-danger',
  };
  return (
    <div className={`rounded-lg border px-4 py-2 text-center bg-bg-soft ${map[tone]}`}>
      <div className="font-bold text-xs">{label}</div>
      <div className="mono text-[10px] text-muted mt-0.5">{sub}</div>
    </div>
  );
}
function Arrow() {
  return <span className="text-muted rotate-90 sm:rotate-0">↓</span>;
}

function PolicyColumn({
  title,
  tone,
  rules,
}: {
  title: string;
  tone: 'ok' | 'warn' | 'danger';
  rules: { name: string; reason: string }[];
}) {
  const map = {
    ok: 'text-ok border-ok/30',
    warn: 'text-warn border-warn/30',
    danger: 'text-danger border-danger/30',
  }[tone];
  return (
    <Card className={`!border ${map}`}>
      <h3 className={`font-bold mb-3 ${map.split(' ')[0]}`}>{title}</h3>
      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.name} className="rounded-lg bg-bg-soft p-2.5">
            <div className="mono text-[11px] text-slate-300">{r.name}</div>
            <div className="text-xs text-muted mt-0.5">{r.reason}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
