/**
 * Local DOM perception for the content script. Extracts a lightweight,
 * structured view of the live page — the "DOMAnalyzer" interface in action.
 */
import type { PagePerception, PerceivedElement, ElementRole } from '@pvcc/shared';

function roleOf(el: Element): ElementRole {
  const tag = el.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (tag === 'button' || (el as HTMLElement).getAttribute('role') === 'button') return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return 'input';
  if (tag === 'img') return 'image';
  if (tag === 'nav') return 'nav';
  if (tag === 'label') return 'label';
  return 'text';
}

export function perceivePage(): PagePerception {
  const elements: PerceivedElement[] = [];
  const seen = new Set<string>();
  let idx = 0;

  const candidates = document.querySelectorAll(
    'h1,h2,h3,h4,p,span,a,button,input,select,textarea,label,li,td,div[role="status"]',
  );

  candidates.forEach((node) => {
    const el = node as HTMLElement;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return; // skip hidden
    const text = (el.tagName === 'INPUT' ? '' : el.innerText || '').trim().slice(0, 200);
    const role = roleOf(el);
    const interactive = ['button', 'link', 'input'].includes(role);
    if (!text && !interactive) return;
    const key = `${role}:${text}`;
    if (seen.has(key) && !interactive) return;
    seen.add(key);

    const attributes: Record<string, string> = {};
    if (el.tagName === 'INPUT') {
      const inp = el as HTMLInputElement;
      attributes.type = inp.type;
      if (inp.name) attributes.name = inp.name;
    }

    elements.push({
      id: el.id || `el_${idx++}`,
      role,
      text,
      attributes: Object.keys(attributes).length ? attributes : undefined,
      interactive,
      box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
  });

  const rawText = elements.map((e) => e.text).filter(Boolean).join('\n');

  return {
    url: location.href,
    title: document.title,
    pageType: classifyPage(rawText),
    elements: elements.slice(0, 120),
    rawText,
  };
}

function classifyPage(text: string): string {
  const t = text.toLowerCase();
  if (/order|shipment|delivery|cart/.test(t)) return 'ecommerce_page';
  if (/otp|payment|card number|cvv/.test(t)) return 'payment_page';
  if (/aadhaar|pan|profile|date of birth/.test(t)) return 'profile_page';
  if (/register|sign ?up|form/.test(t)) return 'form_page';
  return 'generic_page';
}
