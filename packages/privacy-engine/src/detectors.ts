/**
 * Rule-based sensitive-entity detectors.
 *
 * These are intentionally lightweight (regex + validation heuristics) so they
 * can run entirely on-device with negligible CPU cost. Each detector is a pure
 * function returning zero or more raw matches. The DetectorRegistry is the
 * pluggable seam: a real ML/NER model can be registered as another Detector
 * without touching the pipeline.
 */
import type { SensitiveType, Sensitivity, RedactionAction } from '@pvcc/shared';

export interface RawMatch {
  type: SensitiveType;
  value: string;
  start: number;
  end: number;
  confidence: number;
  detector: string;
}

export interface Detector {
  name: string;
  types: SensitiveType[];
  detect: (text: string) => RawMatch[];
}

// --- Policy metadata for each type -----------------------------------------

export const SENSITIVITY: Record<SensitiveType, Sensitivity> = {
  OTP: 'CRITICAL',
  PASSWORD: 'CRITICAL',
  CREDIT_CARD: 'CRITICAL',
  API_KEY: 'CRITICAL',
  AADHAAR: 'HIGH',
  PAN: 'HIGH',
  DOB: 'HIGH',
  EMAIL: 'MEDIUM',
  PHONE: 'MEDIUM',
  ADDRESS: 'MEDIUM',
  PERSON_NAME: 'LOW',
  IP_ADDRESS: 'LOW',
};

export const DEFAULT_ACTION: Record<SensitiveType, RedactionAction> = {
  OTP: 'DROP',
  PASSWORD: 'DROP',
  CREDIT_CARD: 'MASK',
  API_KEY: 'DROP',
  AADHAAR: 'MASK',
  PAN: 'MASK',
  DOB: 'REDACT',
  EMAIL: 'REDACT',
  PHONE: 'REDACT',
  ADDRESS: 'REDACT',
  PERSON_NAME: 'REDACT',
  IP_ADDRESS: 'HASH',
};

export const REASON: Record<SensitiveType, string> = {
  OTP: 'One-time passcode — never transmit off device',
  PASSWORD: 'Credential — never transmit off device',
  CREDIT_CARD: 'Payment card number detected locally',
  API_KEY: 'Secret token detected locally',
  AADHAAR: 'National identity number detected locally',
  PAN: 'Tax identity number detected locally',
  DOB: 'Date of birth is PII',
  EMAIL: 'Email address is PII',
  PHONE: 'Phone number is PII',
  ADDRESS: 'Postal address is PII',
  PERSON_NAME: 'Personal name is PII',
  IP_ADDRESS: 'IP address can identify a user',
};

// --- Helpers ----------------------------------------------------------------

function* matchAll(re: RegExp, text: string): Generator<RegExpExecArray> {
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    if (m.index === r.lastIndex) r.lastIndex++;
    yield m;
  }
}

/** Luhn check to reduce credit-card false positives. */
function luhnValid(digits: string): boolean {
  const d = digits.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// --- Detectors --------------------------------------------------------------

const email: Detector = {
  name: 'regex.email',
  types: ['EMAIL'],
  detect: (text) => {
    const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return [...matchAll(re, text)].map((m) => ({
      type: 'EMAIL' as const,
      value: m[0],
      start: m.index,
      end: m.index + m[0].length,
      confidence: 0.99,
      detector: 'regex.email',
    }));
  },
};

const phone: Detector = {
  name: 'regex.phone_in',
  types: ['PHONE'],
  detect: (text) => {
    // Indian style: optional +91, 10 digits (7-9 leading), optional spaces/dashes.
    const re = /(?:\+91[\s-]?)?(?<!\d)[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;
    return [...matchAll(re, text)].map((m) => ({
      type: 'PHONE' as const,
      value: m[0].trim(),
      start: m.index,
      end: m.index + m[0].length,
      confidence: 0.94,
      detector: 'regex.phone_in',
    }));
  },
};

const otp: Detector = {
  name: 'context.otp',
  types: ['OTP'],
  detect: (text) => {
    // Require an OTP keyword nearby to avoid flagging every 6-digit number.
    const re = /\b(?:otp|one[-\s]?time\s+(?:pass(?:word|code)|code)|verification\s+code)\b[^0-9]{0,20}(\d{4,8})/gi;
    const out: RawMatch[] = [];
    for (const m of matchAll(re, text)) {
      const codeIndex = m.index + m[0].lastIndexOf(m[1]);
      out.push({
        type: 'OTP',
        value: m[1],
        start: codeIndex,
        end: codeIndex + m[1].length,
        confidence: 0.97,
        detector: 'context.otp',
      });
    }
    return out;
  },
};

const creditCard: Detector = {
  name: 'regex.card+luhn',
  types: ['CREDIT_CARD'],
  detect: (text) => {
    const re = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g;
    const out: RawMatch[] = [];
    for (const m of matchAll(re, text)) {
      const raw = m[0].trim();
      const digits = raw.replace(/\D/g, '');
      if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
        out.push({
          type: 'CREDIT_CARD',
          value: raw,
          start: m.index,
          end: m.index + m[0].length,
          confidence: 0.96,
          detector: 'regex.card+luhn',
        });
      }
    }
    return out;
  },
};

const aadhaar: Detector = {
  name: 'regex.aadhaar',
  types: ['AADHAAR'],
  detect: (text) => {
    // 12 digits, typically grouped 4-4-4. Reduce FP by not matching Luhn-valid cards.
    const re = /(?<!\d)[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g;
    const out: RawMatch[] = [];
    for (const m of matchAll(re, text)) {
      const digits = m[0].replace(/\D/g, '');
      if (digits.length === 12 && !luhnValid(digits)) {
        out.push({
          type: 'AADHAAR',
          value: m[0].trim(),
          start: m.index,
          end: m.index + m[0].length,
          confidence: 0.9,
          detector: 'regex.aadhaar',
        });
      }
    }
    return out;
  },
};

const pan: Detector = {
  name: 'regex.pan',
  types: ['PAN'],
  detect: (text) => {
    const re = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
    return [...matchAll(re, text)].map((m) => ({
      type: 'PAN' as const,
      value: m[0],
      start: m.index,
      end: m.index + m[0].length,
      confidence: 0.93,
      detector: 'regex.pan',
    }));
  },
};

const apiKey: Detector = {
  name: 'regex.apikey',
  types: ['API_KEY'],
  detect: (text) => {
    const re = /\b(?:sk|pk|api|key|token|ghp|xox[baprs])[-_][A-Za-z0-9]{16,}\b/g;
    return [...matchAll(re, text)].map((m) => ({
      type: 'API_KEY' as const,
      value: m[0],
      start: m.index,
      end: m.index + m[0].length,
      confidence: 0.88,
      detector: 'regex.apikey',
    }));
  },
};

const dob: Detector = {
  name: 'context.dob',
  types: ['DOB'],
  detect: (text) => {
    const re = /\b(?:date\s+of\s+birth|dob|born)\b[^0-9]{0,12}(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/gi;
    const out: RawMatch[] = [];
    for (const m of matchAll(re, text)) {
      const idx = m.index + m[0].lastIndexOf(m[1]);
      out.push({
        type: 'DOB',
        value: m[1],
        start: idx,
        end: idx + m[1].length,
        confidence: 0.85,
        detector: 'context.dob',
      });
    }
    return out;
  },
};

const address: Detector = {
  name: 'heuristic.address_in',
  types: ['ADDRESS'],
  detect: (text) => {
    // Line containing a 6-digit Indian PIN code alongside street-like tokens.
    const re = /[^\n]*\b\d{6}\b[^\n]*/g;
    const out: RawMatch[] = [];
    for (const m of matchAll(re, text)) {
      const line = m[0];
      if (/\b(road|rd|street|st|floor|tower|nagar|lane|block|sector|colony|view|apartment|apt)\b/i.test(line)) {
        // Trim leading label like "Ship to: " / "Address: "
        const cleaned = line.replace(/^\s*(ship to|address|addr|deliver to)\s*:?\s*/i, '');
        const offset = line.length - cleaned.length;
        out.push({
          type: 'ADDRESS',
          value: cleaned.trim(),
          start: m.index + offset,
          end: m.index + line.length,
          confidence: 0.8,
          detector: 'heuristic.address_in',
        });
      }
    }
    return out;
  },
};

const ipAddress: Detector = {
  name: 'regex.ipv4',
  types: ['IP_ADDRESS'],
  detect: (text) => {
    const re = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
    return [...matchAll(re, text)].map((m) => ({
      type: 'IP_ADDRESS' as const,
      value: m[0],
      start: m.index,
      end: m.index + m[0].length,
      confidence: 0.82,
      detector: 'regex.ipv4',
    }));
  },
};

/**
 * Name detector. Deliberately conservative: matches "Welcome <Name>",
 * "Profile: <Name>", "Hi <Name>" patterns. This is where a real NER model
 * would plug in for open-domain name recognition.
 */
const personName: Detector = {
  name: 'heuristic.name_context',
  types: ['PERSON_NAME'],
  detect: (text) => {
    const re =
      /\b(?:welcome(?:\s+back)?|hi|hello|dear|profile|name|mr\.?|ms\.?|mrs\.?)\b[\s,:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/g;
    const out: RawMatch[] = [];
    for (const m of matchAll(re, text)) {
      const idx = m.index + m[0].lastIndexOf(m[1]);
      out.push({
        type: 'PERSON_NAME',
        value: m[1],
        start: idx,
        end: idx + m[1].length,
        confidence: 0.72,
        detector: 'heuristic.name_context',
      });
    }
    return out;
  },
};

/**
 * Field-based detector: password inputs are sensitive regardless of value.
 * Consumed via detectFields (works on DOM attributes, not text).
 */
export function detectPasswordFields(
  elements: { id: string; role: string; attributes?: Record<string, string> }[],
): RawMatch[] {
  return elements
    .filter((e) => e.attributes?.type === 'password')
    .map((e) => ({
      type: 'PASSWORD' as const,
      value: `[password field #${e.id}]`,
      start: -1,
      end: -1,
      confidence: 1,
      detector: 'dom.password_field',
    }));
}

export const DEFAULT_DETECTORS: Detector[] = [
  email,
  phone,
  otp,
  creditCard,
  aadhaar,
  pan,
  apiKey,
  dob,
  address,
  ipAddress,
  personName,
];
