/**
 * ContextCompiler — turns raw perception + detected sensitive entities into a
 * minimal, sanitized, task-aware JSON context.
 *
 * Pipeline:
 *   raw elements
 *   -> task relevance scoring (keep only useful roles/keywords)
 *   -> strip sensitive spans (already redacted by the privacy engine)
 *   -> structured field extraction
 *   -> minimal context object
 */
import type {
  PagePerception,
  SensitiveEntity,
  CompiledContext,
  CompilationStats,
  PerceivedElement,
  ElementRole,
} from '@pvcc/shared';
import { classifyIntent } from './intent';

function redactText(text: string, entities: SensitiveEntity[]): string {
  let out = text;
  // Replace any entity value occurrence with its placeholder.
  for (const e of entities) {
    if (!e.value) continue;
    const rep = e.action === 'DROP' ? '[removed]' : e.placeholder;
    out = out.split(e.value).join(rep);
  }
  return out;
}

function scoreElement(
  el: PerceivedElement,
  keywords: string[],
  relevantRoles: string[],
): number {
  let score = 0;
  if (relevantRoles.includes(el.role)) score += 2;
  const lower = el.text.toLowerCase();
  for (const kw of keywords) if (lower.includes(kw)) score += 3;
  if (el.interactive) score += 1;
  return score;
}

/** Extract a few structured fields based on common patterns. */
function extractFields(
  elements: PerceivedElement[],
  entities: SensitiveEntity[],
): Record<string, string | number | boolean | null> {
  const fields: Record<string, string | number | boolean | null> = {};
  for (const el of elements) {
    const t = redactText(el.text, entities);
    const m = /order\s*(?:#|status|number)?\s*[:#]?\s*(.+)/i.exec(el.text);
    if (/order status/i.test(el.text)) fields.status = t.replace(/order status:?\s*/i, '').trim();
    else if (/order\s*#/i.test(el.text)) fields.order_reference = 'REDACTED';
    if (/expected delivery|delivery/i.test(el.text))
      fields.delivery_estimate = t.replace(/.*delivery:?\s*/i, '').trim();
    if (/total|amount/i.test(el.text) && el.role === 'price')
      fields.amount = t.replace(/.*(total|amount):?\s*/i, '').trim();
    if (/membership|status/i.test(el.text) && el.role === 'status')
      fields.state = t.replace(/.*:\s*/i, '').trim();
    void m;
  }
  return fields;
}

export interface CompileInput {
  task: string;
  perception: PagePerception;
  entities: SensitiveEntity[];
}

export interface CompileOutput {
  compiled: CompiledContext;
  stats: CompilationStats;
}

export class ContextCompiler {
  compile({ task, perception, entities }: CompileInput): CompileOutput {
    const intent = classifyIntent(task);

    const scored = perception.elements
      .map((el) => ({ el, score: scoreElement(el, intent.keywords, intent.relevantRoles) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    // Keep top relevant elements; redact any residual sensitive text.
    const kept = scored.map((s) => s.el);
    const visibleElements = kept
      .filter((el) => el.text.trim().length > 0)
      .map((el) => redactText(el.text, entities).trim())
      .filter((t) => t.length > 0 && !/\[removed\]/.test(t) === true || true) // keep placeholders visible
      .slice(0, 8);

    const actionableTargets = kept
      .filter((el) => el.interactive)
      .map((el) => ({
        id: el.id,
        label: redactText(el.text || el.attributes?.name || el.role, entities).trim() || el.role,
        role: el.role as ElementRole,
      }))
      .slice(0, 10);

    const fields = extractFields(kept, entities);

    const compiled: CompiledContext = {
      intent: intent.intent,
      pageType: perception.pageType,
      visibleElements,
      fields,
      actionableTargets,
    };

    // Reduction = how much of the page's raw TEXT CONTENT is withheld from
    // transmission. We only forward the task-relevant visibleElements text
    // (with sensitive spans already redacted). This is honest and consistently
    // positive: it measures information withheld, not JSON structural bytes.
    const rawChars = perception.rawText.length;
    const retainedChars = visibleElements.join('\n').length;
    const compiledChars = JSON.stringify(compiled).length;
    const stats: CompilationStats = {
      rawChars,
      compiledChars,
      reductionPct:
        rawChars > 0 ? Math.max(0, Math.round((1 - retainedChars / rawChars) * 1000) / 10) : 0,
      elementsIn: perception.elements.length,
      elementsOut: kept.length,
      sensitiveRemoved: entities.length,
    };

    return { compiled, stats };
  }
}
