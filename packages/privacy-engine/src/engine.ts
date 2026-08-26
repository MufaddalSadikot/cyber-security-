/**
 * PrivacyEngine — orchestrates detectors, resolves overlaps, assigns
 * redaction actions and produces both a sanitized text and the list of
 * SensitiveEntity records for the UI/audit trail.
 *
 * Pluggability: pass a custom detector list (e.g. including an ML/NER
 * detector) to the constructor. The rest of the pipeline is unchanged.
 */
import type {
  SensitiveEntity,
  RedactionAction,
  PerceivedElement,
} from '@pvcc/shared';
import {
  DEFAULT_DETECTORS,
  DEFAULT_ACTION,
  SENSITIVITY,
  REASON,
  detectPasswordFields,
  type Detector,
  type RawMatch,
} from './detectors';

let counter = 0;
const genId = () => `ent_${Date.now().toString(36)}_${(counter++).toString(36)}`;

function placeholderFor(type: string, action: RedactionAction, value: string): string {
  if (action === 'DROP') return '';
  if (action === 'MASK') {
    const digits = value.replace(/\D/g, '');
    const last4 = digits.slice(-4);
    return last4 ? `[${type}:••••${last4}]` : `[${type}:MASKED]`;
  }
  if (action === 'HASH') {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
    return `[${type}:#${(h >>> 0).toString(16).slice(0, 8)}]`;
  }
  return `[REDACTED:${type}]`;
}

export interface AnalyzeInput {
  text: string;
  elements?: PerceivedElement[];
}

export interface AnalyzeResult {
  entities: SensitiveEntity[];
  sanitizedText: string;
}

export class PrivacyEngine {
  private detectors: Detector[];

  constructor(detectors: Detector[] = DEFAULT_DETECTORS) {
    this.detectors = detectors;
  }

  /** Run all detectors, resolve overlaps (keep highest confidence). */
  private collectMatches(text: string): RawMatch[] {
    const raw: RawMatch[] = [];
    for (const d of this.detectors) {
      try {
        raw.push(...d.detect(text));
      } catch {
        /* a broken detector must never break the pipeline */
      }
    }
    raw.sort((a, b) => a.start - b.start || b.confidence - a.confidence);
    const kept: RawMatch[] = [];
    let lastEnd = -1;
    for (const m of raw) {
      if (m.start < 0) continue; // field-only matches handled separately
      if (m.start >= lastEnd) {
        kept.push(m);
        lastEnd = m.end;
      } else {
        // overlap: replace previous if this one is more confident & fully covers
        const prev = kept[kept.length - 1];
        if (prev && m.confidence > prev.confidence && m.end >= prev.end) {
          kept[kept.length - 1] = m;
          lastEnd = m.end;
        }
      }
    }
    return kept;
  }

  analyze(input: AnalyzeInput): AnalyzeResult {
    const { text, elements = [] } = input;
    const matches = this.collectMatches(text);

    const entities: SensitiveEntity[] = matches.map((m) => {
      const action = DEFAULT_ACTION[m.type];
      return {
        id: genId(),
        type: m.type,
        value: m.value,
        placeholder: placeholderFor(m.type, action, m.value),
        confidence: m.confidence,
        sensitivity: SENSITIVITY[m.type],
        action,
        start: m.start,
        end: m.end,
        reason: REASON[m.type],
        detector: m.detector,
      };
    });

    // Field-based detections (password inputs) — no text offsets.
    for (const pf of detectPasswordFields(elements)) {
      entities.push({
        id: genId(),
        type: 'PASSWORD',
        value: pf.value,
        placeholder: '',
        confidence: pf.confidence,
        sensitivity: SENSITIVITY.PASSWORD,
        action: DEFAULT_ACTION.PASSWORD,
        elementId: pf.value.match(/#(\S+)\]/)?.[1],
        reason: REASON.PASSWORD,
        detector: pf.detector,
      });
    }

    return { entities, sanitizedText: this.sanitize(text, matches, entities) };
  }

  private sanitize(text: string, matches: RawMatch[], entities: SensitiveEntity[]): string {
    // Rebuild string replacing each match span with its placeholder.
    const spanEntities = entities.filter((e) => e.start != null && e.start >= 0);
    spanEntities.sort((a, b) => (b.start ?? 0) - (a.start ?? 0)); // right-to-left
    let out = text;
    for (const e of spanEntities) {
      const before = out.slice(0, e.start);
      const after = out.slice(e.end);
      const rep = e.action === 'DROP' ? '[removed]' : e.placeholder;
      out = before + rep + after;
    }
    return out;
  }

  /** Convenience: map an entity onto a specific element for the inspector UI. */
  static attachElements(
    entities: SensitiveEntity[],
    elements: PerceivedElement[],
  ): SensitiveEntity[] {
    return entities.map((e) => {
      if (e.elementId) return e;
      const host = elements.find((el) => el.text && e.value && el.text.includes(e.value));
      return host ? { ...e, elementId: host.id, box: host.box } : e;
    });
  }
}

export { DEFAULT_DETECTORS, SENSITIVITY, DEFAULT_ACTION } from './detectors';
export type { Detector, RawMatch } from './detectors';
