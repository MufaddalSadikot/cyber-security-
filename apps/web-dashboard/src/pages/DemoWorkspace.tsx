import { useMemo, useRef, useState } from 'react';
import { SCENARIOS, getScenario } from '@pvcc/shared';
import type { PipelineResult, SensitiveEntity, TaskStage } from '@pvcc/shared';
import { runPipeline } from '../lib/pipeline';
import { api } from '../lib/api';
import BrowserFrame from '../components/BrowserFrame';
import {
  Card,
  DecisionBadge,
  DemoTag,
  SectionTitle,
  SensitivityBadge,
  Spinner,
  StageChip,
} from '../components/ui';
import { IconPlay, IconShield } from '../components/icons';
import clsx from 'clsx';

const STAGES: TaskStage[] = [
  'PERCEIVING',
  'SANITIZING',
  'COMPILING',
  'REASONING',
  'POLICY_CHECK',
  'EXECUTING',
];

const stageToDiagram: Record<string, number> = {
  PERCEIVING: 1,
  SANITIZING: 2,
  COMPILING: 4,
  REASONING: 5,
  POLICY_CHECK: 6,
  EXECUTING: 7,
  BLOCKED: 6,
};

export default function DemoWorkspace() {
  const [scenarioId, setScenarioId] = useState('ecommerce_order');
  const [task, setTask] = useState('Find my order status');
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<TaskStage>('QUEUED');
  const [partialEntities, setPartialEntities] = useState<SensitiveEntity[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [redact, setRedact] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const [log, setLog] = useState<{ t: string; msg: string; ok: boolean }[]>([]);

  const scenario = getScenario(scenarioId)!;

  const addLog = (msg: string, ok = true) => {
    const t = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLog((l) => [...l, { t, msg, ok }]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 30);
  };

  const run = async () => {
    setRunning(true);
    setResult(null);
    setRedact(false);
    setPartialEntities([]);
    setLog([]);
    addLog(`Task queued: "${task}"`);

    try {
      const res = await runPipeline(scenarioId, task, {
        stageDelay: 650,
        onStage: (s, partial) => {
          setStage(s);
          if (s === 'PERCEIVING') addLog(`LOCAL_PERCEPTION · reading DOM + text on device`);
          if (s === 'SANITIZING' && partial.entities) {
            setPartialEntities(partial.entities);
            setRedact(true);
            addLog(`PII_DETECTION · ${partial.entities.length} sensitive entities found locally`);
            addLog(`REDACTION · sanitizing before any transmission`);
          }
          if (s === 'COMPILING' && partial.stats) {
            addLog(`CONTEXT_COMPILATION · reduced ${partial.stats.reductionPct}% of raw content`);
          }
          if (s === 'REASONING') addLog(`SERVER_REQUEST · sanitized context only → remote AI`);
          if (s === 'POLICY_CHECK' && partial.policy) {
            addLog(
              `ACTION_POLICY · ${partial.policy.decision} (${partial.policy.rule})`,
              partial.policy.decision !== 'BLOCK',
            );
          }
          if (s === 'EXECUTING') addLog(`BROWSER_EXECUTION · action executed`, true);
          if (s === 'BLOCKED') addLog(`BROWSER_EXECUTION · blocked, not executed`, false);
        },
      });
      setResult(res);

      // Persist run server-side (sanitized data only).
      try {
        const created = await api.post<{ id: string }>('/tasks', {
          scenario_id: scenarioId,
          instruction: task,
        });
        await api.post(`/tasks/${created.id}/run`, {
          scenario_id: scenarioId,
          instruction: task,
          perception: res.perception,
          entities: res.entities.map(({ value, ...rest }) => ({ ...rest })),
          compiled: res.compiled,
          stats: res.stats,
          action: res.action,
          policy: res.policy,
          timings: res.timings,
          total_ms: res.totalMs,
          transmitted_payload: res.transmittedPayload,
          baseline_bytes: res.baselineBytes,
          sanitized_bytes: res.sanitizedBytes,
        });
      } catch {
        /* offline persistence is non-fatal for the demo */
      }
    } finally {
      setRunning(false);
    }
  };

  const entities = result?.entities ?? partialEntities;
  const diagramIdx = result
    ? result.policy.decision === 'BLOCK'
      ? 6
      : 7
    : stageToDiagram[stage];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-50">Demo Workspace</h1>
          <p className="text-muted text-sm">
            Watch the full privacy pipeline execute — on-device detection, redaction, minimal
            transmission, and local policy enforcement.
          </p>
        </div>
        <DemoTag />
      </div>

      {/* Controls */}
      <Card>
        <div className="grid md:grid-cols-[1fr_1.4fr_auto] gap-3 items-end">
          <div>
            <label className="label block mb-1.5">Scenario (webpage)</label>
            <select
              className="input"
              value={scenarioId}
              onChange={(e) => {
                setScenarioId(e.target.value);
                setTask(getScenario(e.target.value)!.suggestedTasks[0]);
                setResult(null);
                setRedact(false);
                setLog([]);
              }}
              disabled={running}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label block mb-1.5">Agent task</label>
            <div className="flex gap-2">
              <input className="input" value={task} onChange={(e) => setTask(e.target.value)} disabled={running} />
            </div>
          </div>
          <button className="btn-primary !py-2.5" onClick={run} disabled={running}>
            {running ? <Spinner /> : <IconPlay />} {running ? 'Running…' : 'Run pipeline'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {scenario.suggestedTasks.map((t) => (
            <button
              key={t}
              onClick={() => setTask(t)}
              disabled={running}
              className={clsx(
                'badge border text-xs',
                t === task ? 'border-brand text-brand-soft bg-brand/10' : 'border-line text-muted hover:text-slate-200',
              )}
            >
              {t}
            </button>
          ))}
          {scenario.flavor === 'bank' && (
            <span className="badge bg-danger/10 text-danger border border-danger/30 text-xs">
              ⚠ Danger scenario — try “Read the OTP and continue”
            </span>
          )}
        </div>
      </Card>

      {/* Split screen */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* LEFT: browser */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="label">Left · Browser / webpage</span>
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input type="checkbox" checked={redact} onChange={(e) => setRedact(e.target.checked)} />
              Show redaction overlay
            </label>
          </div>
          <BrowserFrame
            scenario={scenario}
            entities={entities}
            redact={redact}
            highlightTargetId={result?.action.targetId}
            actionState={
              result ? { action: result.action, blocked: result.policy.decision === 'BLOCK' } : undefined
            }
          />
          <Card className="!p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-muted">Elements</div>
                <div className="text-lg font-bold text-slate-100">{scenario.elements.length}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Sensitive found</div>
                <div className="text-lg font-bold text-danger">{entities.length}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Total latency</div>
                <div className="text-lg font-bold text-brand-soft">
                  {result ? `${result.totalMs} ms` : '—'}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT: agent + privacy console */}
        <div className="space-y-3">
          <span className="label">Right · AI Agent + Privacy Console</span>

          {/* Stage tracker */}
          <Card className="!p-4">
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <StageChip key={s} stage={s} active={stage === s && running} />
              ))}
              {result?.policy.decision === 'BLOCK' && <StageChip stage="BLOCKED" />}
            </div>
          </Card>

          {/* Pipeline diagram + console */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3">
            <Card className="!p-3">
              <MiniPipeline activeIndex={diagramIdx} />
            </Card>
            <Card className="!p-0 overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b border-line label">Live audit console</div>
              <div ref={logRef} className="p-3 space-y-1.5 overflow-y-auto max-h-64 min-h-[180px]">
                {log.length === 0 && <div className="text-xs text-muted">Run the pipeline to see live events…</div>}
                {log.map((l, i) => (
                  <div key={i} className="mono text-[11px] flex gap-2">
                    <span className="text-muted">{l.t}</span>
                    <span className={l.ok ? 'text-slate-300' : 'text-danger'}>
                      {l.ok ? '✓' : '⛔'} {l.msg}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Result summary */}
          {result && (
            <>
              <Card>
                <SectionTitle title="Detected sensitive elements" icon={<IconShield />} />
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {entities.length === 0 && <div className="text-sm text-muted">No sensitive data detected.</div>}
                  {entities.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <SensitivityBadge level={e.sensitivity} />
                        <span className="font-semibold text-slate-200">{e.type}</span>
                        <span className="mono text-xs text-danger">{e.action}</span>
                      </div>
                      <span className="mono text-xs text-muted">{(e.confidence * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid sm:grid-cols-2 gap-3">
                <Card>
                  <div className="label mb-2">Context sent to server</div>
                  <pre className="mono text-[10px] text-accent bg-bg-soft rounded-lg p-3 overflow-x-auto max-h-52">
                    {JSON.stringify(result.transmittedPayload, null, 2)}
                  </pre>
                </Card>
                <div className="space-y-3">
                  <Card>
                    <div className="label mb-2">Remote AI result</div>
                    <p className="text-sm text-slate-300 mb-2">
                      {(result.transmittedPayload as { result_summary?: string }).result_summary}
                    </p>
                    <div className="text-xs text-muted">
                      Proposed action:{' '}
                      <span className="mono text-brand-soft">
                        {result.action.type}
                        {result.action.targetLabel ? ` → “${result.action.targetLabel}”` : ''}
                      </span>
                    </div>
                  </Card>
                  <Card
                    className={clsx(
                      result.policy.decision === 'BLOCK' && '!border-danger/50',
                      result.policy.decision === 'ALLOW' && '!border-ok/40',
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="label">Local policy decision</span>
                      <DecisionBadge decision={result.policy.decision} />
                    </div>
                    <div className="text-xs mono text-muted mb-1">{result.policy.rule}</div>
                    <p className="text-sm text-slate-300">{result.policy.reason}</p>
                  </Card>
                </div>
              </div>

              {/* Byte comparison */}
              <Card>
                <div className="label mb-3">Data leaving the browser</div>
                <ByteBar
                  label="Naive baseline (raw screenshot + DOM)"
                  bytes={result.baselineBytes}
                  max={result.baselineBytes}
                  tone="danger"
                />
                <div className="h-2" />
                <ByteBar
                  label="PVCC sanitized context"
                  bytes={result.sanitizedBytes}
                  max={result.baselineBytes}
                  tone="ok"
                />
                <div className="text-xs text-muted mt-3">
                  {(100 - (result.sanitizedBytes / result.baselineBytes) * 100).toFixed(1)}% smaller
                  payload · 0 raw sensitive values transmitted
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniPipeline({ activeIndex }: { activeIndex?: number }) {
  const steps = ['Raw', 'Perceive', 'Detect PII', 'Compile', 'Sanitized', 'Remote AI', 'Policy', 'Execute'];
  const tones = ['danger', 'brand', 'accent', 'accent', 'ok', 'brand', 'warn', 'ok'];
  const map: Record<string, string> = {
    danger: 'bg-danger',
    brand: 'bg-brand',
    accent: 'bg-accent',
    ok: 'bg-ok',
    warn: 'bg-warn',
  };
  return (
    <div className="flex flex-col gap-1 w-28">
      {steps.map((s, i) => (
        <div key={s}>
          <div
            className={clsx(
              'rounded-md px-2 py-1 text-[10px] font-semibold text-white/90 transition-all',
              map[tones[i]],
              activeIndex !== undefined && activeIndex < i && 'opacity-30',
              activeIndex === i && 'ring-2 ring-white/50 scale-105',
            )}
          >
            {s}
          </div>
          {i < steps.length - 1 && <div className="h-1.5 w-px bg-line mx-auto" />}
        </div>
      ))}
    </div>
  );
}

function ByteBar({
  label,
  bytes,
  max,
  tone,
}: {
  label: string;
  bytes: number;
  max: number;
  tone: 'danger' | 'ok';
}) {
  const pct = Math.max(2, (bytes / max) * 100);
  const kb = (bytes / 1024).toFixed(bytes < 10240 ? 2 : 0);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-300">{label}</span>
        <span className={tone === 'danger' ? 'text-danger' : 'text-ok'}>{kb} KB</span>
      </div>
      <div className="h-3 rounded-full bg-bg-soft overflow-hidden">
        <div
          className={clsx('h-full rounded-full', tone === 'danger' ? 'bg-danger' : 'bg-ok')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
