/**
 * Service worker: runs the on-device privacy pipeline using the SAME shared
 * packages as the dashboard. Only sanitized context is ever sent to the API.
 */
import type { PagePerception } from '@pvcc/shared';
import { PrivacyEngine } from '@pvcc/privacy-engine';
import { ContextCompiler } from '@pvcc/context-compiler';
import { ActionPolicyEngine } from '@pvcc/action-policy';

const API_BASE = 'http://localhost:8000'; // configurable per deployment

const privacy = new PrivacyEngine();
const compiler = new ContextCompiler();
const policy = new ActionPolicyEngine();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PVCC_RUN') {
    runPipeline(msg.task as string).then(sendResponse);
    return true; // async
  }
  return false;
});

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function runPipeline(task: string) {
  const tabId = await activeTabId();
  if (!tabId) return { error: 'no active tab' };

  // 1. Perceive (in content script / on device)
  const { perception } = (await chrome.tabs.sendMessage(tabId, { type: 'PVCC_PERCEIVE' })) as {
    perception: PagePerception;
  };

  // 2. Detect + redact locally
  const { entities } = privacy.analyze({ text: perception.rawText, elements: perception.elements });

  // 3. Show redaction overlay on the live page
  await chrome.tabs.sendMessage(tabId, {
    type: 'PVCC_HIGHLIGHT_REDACTED',
    values: entities.map((e) => e.value).filter(Boolean),
  });

  // 4. Compile minimal, task-aware context
  const { compiled, stats } = compiler.compile({ task, perception, entities });

  // 5. Remote reasoning — sanitized context ONLY
  let action;
  try {
    const token = (await chrome.storage.local.get('token')).token;
    const res = await fetch(`${API_BASE}/agent/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ task, scenario_id: perception.pageType, compiled_context: compiled }),
    });
    const data = await res.json();
    action = {
      type: data.action.type,
      targetId: data.action.target_id,
      targetLabel: data.action.target_label,
      value: data.action.value,
      rationale: data.action.rationale,
    };
  } catch (e) {
    return { error: `reasoning failed: ${String(e)}` };
  }

  // 6. Local policy check
  const decision = policy.evaluate(action, { entities, elements: perception.elements });

  // 7. Execute only if allowed
  let executed = false;
  if (decision.decision === 'ALLOW') {
    const r = (await chrome.tabs.sendMessage(tabId, { type: 'PVCC_EXECUTE', action })) as { ok: boolean };
    executed = r.ok;
  }

  return {
    perception: { url: perception.url, pageType: perception.pageType, elementCount: perception.elements.length },
    entities: entities.map((e) => ({ type: e.type, action: e.action, confidence: e.confidence })),
    stats,
    action,
    decision,
    executed,
  };
}
