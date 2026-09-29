import { Card, DemoTag } from '../components/ui';
import { IconPuzzle } from '../components/icons';
import PipelineDiagram from '../components/PipelineDiagram';

export default function ExtensionPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-50">Browser Extension</h1>
          <p className="text-muted text-sm">
            Chrome Manifest V3 · TypeScript. The extension runs the same on-device pipeline against
            real webpages.
          </p>
        </div>
        <DemoTag />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-brand"><IconPuzzle width={22} height={22} /></span>
            <h2 className="font-bold text-slate-100">How the extension enforces the boundary</h2>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            A content script perceives the live DOM and captured text. The{' '}
            <span className="mono text-accent">@pvcc/privacy-engine</span> and{' '}
            <span className="mono text-accent">@pvcc/context-compiler</span> packages — the exact same
            code this dashboard uses — run inside the extension's service worker, entirely on the
            user's machine. Only the sanitized, minimal context is sent to the backend's{' '}
            <span className="mono text-brand-soft">/agent/reason</span> endpoint. The response action
            is checked by <span className="mono text-accent">@pvcc/action-policy</span> before the
            content script is allowed to touch the page.
          </p>

          <div className="rounded-lg bg-bg-soft p-4">
            <div className="label mb-2">Build & load (unpacked)</div>
            <pre className="mono text-[12px] text-slate-300 whitespace-pre-wrap">{`# from the repo root
npm install
npm run build:ext          # outputs apps/browser-extension/dist

# In Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select apps/browser-extension/dist
# 5. Pin "PVCC Agent" and click it on any page`}</pre>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Feature title="Content script" body="Perceives DOM + visible text; applies redaction overlay in-page." />
            <Feature title="Service worker" body="Runs privacy engine + compiler; calls the backend with sanitized context only." />
            <Feature title="Popup UI" body="Enter a task, watch the stages, see the policy decision." />
            <Feature title="Policy guard" body="Blocks credential/OTP/payment actions locally before DOM execution." />
          </div>
        </Card>

        <Card>
          <div className="label mb-3">Pipeline (identical to dashboard)</div>
          <PipelineDiagram compact />
        </Card>
      </div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-bg-soft p-3">
      <div className="font-semibold text-sm text-slate-200 mb-1">{title}</div>
      <div className="text-xs text-muted">{body}</div>
    </div>
  );
}
