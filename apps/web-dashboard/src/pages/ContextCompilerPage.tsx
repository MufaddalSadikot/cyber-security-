import { useMemo, useState } from 'react';
import { SCENARIOS, getScenario } from '@pvcc/shared';
import { PrivacyEngine } from '@pvcc/privacy-engine';
import { ContextCompiler } from '@pvcc/context-compiler';
import { Card, DemoTag } from '../components/ui';
import { IconLayers } from '../components/icons';

const privacy = new PrivacyEngine();
const compiler = new ContextCompiler();

export default function ContextCompilerPage() {
  const [scenarioId, setScenarioId] = useState('ecommerce_order');
  const [task, setTask] = useState('Find my order status');
  const scenario = getScenario(scenarioId)!;

  const { compiled, stats, rawText, buckets } = useMemo(() => {
    const pageText = scenario.elements.map((e) => e.text).filter(Boolean).join('\n');
    const perception = {
      url: scenario.url,
      title: scenario.title,
      pageType: scenario.pageType,
      elements: scenario.elements,
      rawText: pageText,
    };
    const { entities } = privacy.analyze({ text: pageText, elements: scenario.elements });
    const { compiled, stats } = compiler.compile({ task, perception, entities });
    const rawText = pageText;

    // Classify each raw element for the three-bucket visualization.
    const keptTexts = new Set(compiled.visibleElements.map((t) => t.replace(/\[.*?\]/g, '').trim()));
    const buckets = { removed: [] as string[], retained: [] as string[], sanitized: [] as string[] };
    for (const el of scenario.elements) {
      if (!el.text) continue;
      const hasSensitive = entities.some((e) => e.value && el.text.includes(e.value));
      if (hasSensitive) buckets.sanitized.push(el.text);
      else if (compiled.visibleElements.some((v) => v.includes(el.text.slice(0, 12))) || keptTexts.has(el.text.trim()))
        buckets.retained.push(el.text);
      else buckets.removed.push(el.text);
    }
    return { compiled, stats, rawText, buckets };
  }, [scenario, task]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-50">Context Compiler</h1>
          <p className="text-muted text-sm">
            How raw browser information becomes minimal, task-relevant, sanitized JSON.
          </p>
        </div>
        <DemoTag />
      </div>

      <Card>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1.5">Scenario</label>
            <select
              className="input"
              value={scenarioId}
              onChange={(e) => {
                setScenarioId(e.target.value);
                setTask(getScenario(e.target.value)!.suggestedTasks[0]);
              }}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label block mb-1.5">Task</label>
            <input className="input" value={task} onChange={(e) => setTask(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Raw -> Compiled */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line label">Raw content ({stats.rawChars} chars)</div>
          <pre className="p-4 mono text-[12px] text-slate-300 whitespace-pre-wrap max-h-72 overflow-auto">{rawText}</pre>
        </Card>
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line label flex items-center justify-between">
            <span>Compiled context ({stats.compiledChars} chars)</span>
            <span className="badge bg-ok/15 text-ok">−{stats.reductionPct}%</span>
          </div>
          <pre className="p-4 mono text-[11px] text-accent whitespace-pre-wrap max-h-72 overflow-auto">
            {JSON.stringify(compiled, null, 2)}
          </pre>
        </Card>
      </div>

      {/* Buckets */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Bucket
          title="Unnecessary information"
          arrow="→ removed"
          tone="danger"
          items={buckets.removed}
        />
        <Bucket
          title="Task-relevant information"
          arrow="→ retained"
          tone="ok"
          items={buckets.retained}
        />
        <Bucket
          title="Sensitive information"
          arrow="→ sanitized"
          tone="warn"
          items={buckets.sanitized}
        />
      </div>

      {/* Stats */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-brand"><IconLayers /></span>
          <h2 className="font-bold text-slate-100">Compilation statistics</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
          {[
            ['Elements in', stats.elementsIn],
            ['Elements out', stats.elementsOut],
            ['Sensitive removed', stats.sensitiveRemoved],
            ['Raw chars', stats.rawChars],
            ['Reduction', `${stats.reductionPct}%`],
          ].map(([label, val]) => (
            <div key={label} className="rounded-lg bg-bg-soft py-3">
              <div className="text-xs text-muted">{label}</div>
              <div className="text-xl font-bold text-slate-100">{val}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Bucket({
  title,
  arrow,
  tone,
  items,
}: {
  title: string;
  arrow: string;
  tone: 'danger' | 'ok' | 'warn';
  items: string[];
}) {
  const toneCls = {
    danger: 'text-danger border-danger/30',
    ok: 'text-ok border-ok/30',
    warn: 'text-warn border-warn/30',
  }[tone];
  return (
    <Card className={`!border ${toneCls}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-sm text-slate-100">{title}</span>
        <span className={`text-xs font-semibold ${toneCls.split(' ')[0]}`}>{arrow}</span>
      </div>
      <div className="space-y-1.5 max-h-52 overflow-auto">
        {items.length === 0 && <div className="text-xs text-muted">—</div>}
        {items.map((it, i) => (
          <div key={i} className="mono text-[11px] text-slate-400 truncate rounded bg-bg-soft px-2 py-1">
            {it}
          </div>
        ))}
      </div>
    </Card>
  );
}
