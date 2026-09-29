import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import PipelineDiagram from '../components/PipelineDiagram';
import { IconArrow, IconEye, IconGavel, IconLayers, IconLock, IconShield } from '../components/icons';

const priorities = [
  { label: 'Visual-context accuracy', pct: 25 },
  { label: 'Sensitive / PII precision + recall', pct: 20 },
  { label: 'Redaction precision', pct: 20 },
  { label: 'Client resource utilization', pct: 20 },
  { label: 'End-to-end task latency', pct: 15 },
];

const features = [
  {
    icon: IconEye,
    title: 'On-device perception',
    body: 'DOM, text, OCR and lightweight vision are read locally in the browser — nothing raw leaves the device.',
  },
  {
    icon: IconLock,
    title: 'Local privacy engine',
    body: 'PII, OTP, cards, Aadhaar/PAN and credentials are detected and redacted before any network transmission.',
  },
  {
    icon: IconLayers,
    title: 'Task-aware compiler',
    body: 'Only the minimal, task-relevant, sanitized context is compiled and sent to the reasoning layer.',
  },
  {
    icon: IconGavel,
    title: 'Local action policy',
    body: 'Every AI-proposed action is evaluated on-device. Dangerous actions are blocked locally — not trusted to the server.',
  },
];

export default function Landing() {
  const { user } = useAuth();
  const cta = user ? '/app' : '/login';

  return (
    <div className="min-h-screen grid-bg">
      {/* Nav */}
      <header className="max-w-7xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center h-9 w-9 rounded-lg bg-brand/15 text-brand">
            <IconShield />
          </div>
          <div>
            <div className="font-bold text-sm text-slate-100">Privacy-Aware Visual Context Compiler</div>
            <div className="text-[10px] text-muted">SIH26171 · ISRO / Department of Space</div>
          </div>
        </div>
        <Link to={cta} className="btn-primary">
          {user ? 'Open Dashboard' : 'Sign in'} <IconArrow />
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-10 pb-16 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="badge bg-brand/10 text-brand-soft border border-brand/30 mb-5">
            On-device Visual Perception for Light-weight Browser Agents
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight text-slate-50">
            Maximum agent capability.
            <br />
            <span className="text-brand-soft">Minimum unnecessary disclosure.</span>
          </h1>
          <p className="mt-5 text-muted text-lg leading-relaxed max-w-xl">
            Browser agents need visual and contextual understanding of a page to act. Sending raw
            screenshots and DOM — with passwords, OTPs, and identity data — to a remote model is a
            privacy problem. PVCC perceives, detects, and redacts{' '}
            <span className="text-slate-200 font-semibold">locally</span>, transmitting only a
            sanitized, task-aware context.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={user ? '/app/demo' : '/login'} className="btn-primary text-base !px-6 !py-3">
              Launch Live Demo <IconArrow />
            </Link>
            <Link to={cta} className="btn-ghost text-base !px-6 !py-3">
              {user ? 'Dashboard' : 'Sign in'}
            </Link>
          </div>
          <div className="mt-6 text-xs text-muted">
            Demo logins: <span className="mono text-slate-300">admin@pvcc.demo / admin123</span> ·{' '}
            <span className="mono text-slate-300">demo@pvcc.demo / demo123</span>
          </div>
        </div>

        {/* Architecture */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-100">Privacy pipeline</h3>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-ok">
                <span className="h-2 w-2 rounded-full bg-ok" /> On device
              </span>
              <span className="flex items-center gap-1 text-brand-soft">
                <span className="h-2 w-2 rounded-full bg-brand" /> Server
              </span>
            </div>
          </div>
          <PipelineDiagram />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 pb-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((f) => (
          <div key={f.title} className="card p-5">
            <div className="text-brand mb-3">
              <f.icon width={22} height={22} />
            </div>
            <h3 className="font-bold text-slate-100 mb-1.5">{f.title}</h3>
            <p className="text-sm text-muted leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      {/* Evaluation priorities */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="card p-6">
          <h3 className="font-bold text-slate-100 mb-1">Aligned to the official evaluation priorities</h3>
          <p className="text-sm text-muted mb-6">
            Every module in this prototype maps directly to a scored criterion.
          </p>
          <div className="space-y-4">
            {priorities.map((p) => (
              <div key={p.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-200">{p.label}</span>
                  <span className="text-brand-soft font-semibold">{p.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-bg-soft overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-accent"
                    style={{ width: `${p.pct * 4}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        Prototype for Smart India Hackathon 2026 · Problem SIH26171 · ISRO / Department of Space ·
        All demo data is synthetic.
      </footer>
    </div>
  );
}
