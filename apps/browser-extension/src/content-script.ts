/**
 * Content script: perceives the DOM on demand, applies a visible redaction
 * overlay, and executes vetted actions. It relays perception to the service
 * worker (which runs the privacy pipeline) and receives back only vetted,
 * policy-approved actions.
 */
import { perceivePage } from './perceive';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PVCC_PERCEIVE') {
    sendResponse({ perception: perceivePage() });
    return true;
  }

  if (msg.type === 'PVCC_HIGHLIGHT_REDACTED' && Array.isArray(msg.values)) {
    highlightRedacted(msg.values as string[]);
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'PVCC_EXECUTE' && msg.action) {
    const ok = executeAction(msg.action);
    sendResponse({ ok });
    return true;
  }
  return false;
});

function highlightRedacted(values: string[]) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const toWrap: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (values.some((v) => v && node.nodeValue?.includes(v))) toWrap.push(node);
  }
  toWrap.forEach((node) => {
    const span = document.createElement('span');
    span.style.cssText =
      'background:#ef444433;outline:1px solid #ef4444;border-radius:3px;color:#ef4444;';
    span.title = 'Redacted locally by PVCC before transmission';
    span.textContent = node.nodeValue;
    node.parentNode?.replaceChild(span, node);
  });
}

function executeAction(action: { type: string; targetId?: string; targetLabel?: string }): boolean {
  const { type, targetId, targetLabel } = action;
  const el =
    (targetId && document.getElementById(targetId)) ||
    findByText(targetLabel) ||
    null;

  switch (type) {
    case 'SCROLL':
      window.scrollBy({ top: 400, behavior: 'smooth' });
      return true;
    case 'CLICK':
    case 'NAVIGATE':
      if (el) {
        (el as HTMLElement).style.outline = '2px solid #3b82f6';
        (el as HTMLElement).click();
        return true;
      }
      return false;
    default:
      // FILL / SUBMIT / PURCHASE / REVEAL_CREDENTIAL are gated by policy and
      // require confirmation flows not auto-executed by the content script.
      return false;
  }
}

function findByText(label?: string): Element | null {
  if (!label) return null;
  const els = Array.from(document.querySelectorAll('a,button,[role="button"]'));
  return els.find((e) => (e as HTMLElement).innerText?.trim() === label) ?? null;
}
