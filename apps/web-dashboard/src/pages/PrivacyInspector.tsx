import { useMemo, useState } from 'react';
import { PrivacyEngine } from '@pvcc/privacy-engine';
import { Card, DemoTag, SensitivityBadge } from '../components/ui';
import { IconEye } from '../components/icons';

const engine = new PrivacyEngine();

const SAMPLE = `Welcome back, Aarav Mehta
Account: aarav.mehta@example.com
Contact: +91 98765 43210
OTP: your one-time code is 482913
Card: 4539 1488 0343 6467
Aadhaar: 4321 8765 1234
PAN: ABCDE1234F
Date of birth: 14/03/1994
Ship to: 4th Floor, Sunrise Towers, MG Road, Ahmedabad 380009
Order #IND-394821  ·  Status: Shipped  ·  Delivery: Friday
API token: sk_live_9fk28dJ1baQ7mZ0pLxTvWqE`;

export default function PrivacyInspector() {
  const [text, setText] = useState(SAMPLE);

  const { entities, sanitizedText } = useMemo(() => {
    const res = engine.analyze({ text });
    return res;
  }, [text]);

  const transmitted = useMemo(
    () => ({
      note: 'Only sanitized placeholders and metadata leave the device.',
      sanitized_preview: sanitizedText,
      entity_summary: entities.map((e) => ({
        type: e.type,
        action: e.action,
        placeholder: e.placeholder || null,
        confidence: Number(e.confidence.toFixed(3)),
      })),
    }),
    [entities, sanitizedText],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-50">Privacy Inspector</h1>
          <p className="text-muted text-sm">
            Exactly what happens <span className="text-slate-200 font-semibold">before</span> any
            network transmission. Detection runs live, on-device, as you type.
          </p>
        </div>
        <DemoTag />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* RAW */}
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
            <span className="label">1 · Raw page (editable)</span>
            <span className="badge bg-danger/15 text-danger">SENSITIVE</span>
          </div>
          <textarea
            className="w-full h-72 bg-bg-soft p-4 mono text-[12px] text-slate-300 outline-none resize-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </Card>

        {/* SANITIZED */}
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
            <span className="label">2 · Sanitized page</span>
            <span className="badge bg-warn/15 text-warn">REDACTED</span>
          </div>
          <pre className="h-72 overflow-auto bg-bg-soft p-4 mono text-[12px] text-warn whitespace-pre-wrap">
            {sanitizedText}
          </pre>
        </Card>

        {/* TRANSMITTED */}
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
            <span className="label">3 · Transmitted context</span>
            <span className="badge bg-ok/15 text-ok">SAFE TO SEND</span>
          </div>
          <pre className="h-72 overflow-auto bg-bg-soft p-4 mono text-[11px] text-accent whitespace-pre-wrap">
            {JSON.stringify(transmitted, null, 2)}
          </pre>
        </Card>
      </div>

      {/* Detection table */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-brand">
            <IconEye />
          </span>
          <div>
            <h2 className="font-bold text-slate-100">Detected entities ({entities.length})</h2>
            <p className="text-xs text-muted">Each item includes type, confidence, location, action and reason.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-line">
                <th className="py-2 pr-4 font-semibold">Type</th>
                <th className="py-2 pr-4 font-semibold">Sensitivity</th>
                <th className="py-2 pr-4 font-semibold">Confidence</th>
                <th className="py-2 pr-4 font-semibold">Location</th>
                <th className="py-2 pr-4 font-semibold">Action</th>
                <th className="py-2 pr-4 font-semibold">Detector</th>
                <th className="py-2 pr-4 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id} className="border-b border-line/50">
                  <td className="py-2 pr-4 font-semibold text-slate-200">{e.type}</td>
                  <td className="py-2 pr-4"><SensitivityBadge level={e.sensitivity} /></td>
                  <td className="py-2 pr-4 mono text-brand-soft">{(e.confidence * 100).toFixed(1)}%</td>
                  <td className="py-2 pr-4 mono text-xs text-muted">
                    {e.start != null && e.start >= 0 ? `@${e.start}–${e.end}` : e.elementId ?? '—'}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="badge bg-danger/15 text-danger">{e.action}</span>
                  </td>
                  <td className="py-2 pr-4 mono text-xs text-muted">{e.detector}</td>
                  <td className="py-2 pr-4 text-xs text-muted">{e.reason}</td>
                </tr>
              ))}
              {entities.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted text-sm">
                    No sensitive entities detected in the current text.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
