import clsx from 'clsx';
import type { DemoScenario } from '@pvcc/shared';
import type { AgentAction, SensitiveEntity } from '@pvcc/shared';

const flavorAccent: Record<string, string> = {
  ecommerce: 'from-amber-500/20 to-orange-500/10',
  form: 'from-brand/20 to-accent/10',
  profile: 'from-violet-500/20 to-fuchsia-500/10',
  bank: 'from-danger/20 to-rose-500/10',
  public: 'from-ok/20 to-emerald-500/10',
};

/** Simulated browser rendering the scenario page, with live redaction overlay. */
export default function BrowserFrame({
  scenario,
  entities,
  redact,
  highlightTargetId,
  actionState,
}: {
  scenario: DemoScenario;
  entities: SensitiveEntity[];
  redact: boolean;
  highlightTargetId?: string;
  actionState?: { action?: AgentAction; blocked?: boolean };
}) {
  const entityForText = (text: string) =>
    entities.find((e) => e.value && text.includes(e.value));

  const renderText = (text: string) => {
    if (!redact) return text;
    let out = text;
    for (const e of entities) {
      if (!e.value) continue;
      const rep = e.action === 'DROP' ? '████████' : e.placeholder || '████';
      out = out.split(e.value).join(rep);
    }
    return out;
  };

  return (
    <div className="rounded-xl border border-line overflow-hidden bg-bg-soft">
      {/* Chrome */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-bg-card">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-danger/70" />
          <span className="h-3 w-3 rounded-full bg-warn/70" />
          <span className="h-3 w-3 rounded-full bg-ok/70" />
        </div>
        <div className="flex-1 mx-2">
          <div className="mono text-[11px] text-muted bg-bg-soft rounded-md px-2.5 py-1 truncate">
            {scenario.url}
          </div>
        </div>
      </div>

      {/* Page body */}
      <div className={clsx('relative p-5 min-h-[320px] bg-gradient-to-br', flavorAccent[scenario.flavor])}>
        <div className="text-[10px] uppercase tracking-widest text-muted mb-3">
          {scenario.title}
        </div>
        <div className="space-y-2.5">
          {scenario.elements.map((el) => {
            const ent = entityForText(el.text);
            const isRedacted = redact && !!ent;
            const isHighlight = highlightTargetId === el.id;
            const blocked = actionState?.blocked && isHighlight;

            if (el.role === 'input') {
              return (
                <div key={el.id} className="flex items-center gap-2">
                  <input
                    disabled
                    placeholder={el.attributes?.type === 'password' ? '••••••••' : el.text || el.attributes?.name}
                    className={clsx(
                      'input !py-1.5 max-w-xs',
                      isHighlight && !blocked && 'ring-2 ring-brand',
                      blocked && 'ring-2 ring-danger',
                    )}
                  />
                  {el.attributes?.type === 'password' && (
                    <span className="badge bg-danger/15 text-danger text-[10px]">password</span>
                  )}
                </div>
              );
            }
            if (el.role === 'button' || el.role === 'link') {
              return (
                <button
                  key={el.id}
                  className={clsx(
                    'text-sm rounded-md px-3 py-1.5 mr-2 font-medium transition-all',
                    el.role === 'button' ? 'bg-brand/20 text-brand-soft' : 'text-brand-soft underline underline-offset-2',
                    isHighlight && !blocked && 'ring-2 ring-brand shadow-glow scale-105',
                    blocked && 'ring-2 ring-danger opacity-60 line-through',
                  )}
                >
                  {el.text}
                </button>
              );
            }
            return (
              <div
                key={el.id}
                className={clsx(
                  'text-sm relative inline-block rounded px-1',
                  el.role === 'heading' && 'text-lg font-bold text-slate-100',
                  el.role === 'price' && 'font-semibold text-ok',
                  el.role === 'status' && 'font-semibold text-brand-soft',
                  el.role === 'text' && 'text-slate-300',
                  isRedacted && 'bg-danger/20 text-danger ring-1 ring-danger/40 font-mono',
                )}
              >
                {renderText(el.text)}
                {isRedacted && (
                  <span className="absolute -top-2 -right-2 badge bg-danger text-white text-[8px] px-1 py-0">
                    {ent!.type}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {actionState?.blocked && (
          <div className="absolute inset-0 grid place-items-center bg-bg/70 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-4xl mb-2">⛔</div>
              <div className="font-bold text-danger">ACTION BLOCKED LOCALLY</div>
              <div className="text-xs text-muted mt-1 max-w-xs">
                The local policy engine prevented this action before execution.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
