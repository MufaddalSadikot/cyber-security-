/**
 * Shared domain types for the Privacy-Aware Visual Context Compiler.
 *
 * These types are the contract between:
 *   - the local privacy pipeline (packages/privacy-engine, context-compiler, action-policy)
 *   - the browser extension (apps/browser-extension)
 *   - the web dashboard (apps/web-dashboard)
 *   - the API (apps/api mirrors these in Pydantic)
 */

// ---------------------------------------------------------------------------
// Sensitive entity detection
// ---------------------------------------------------------------------------

export type SensitiveType =
  | 'EMAIL'
  | 'PHONE'
  | 'OTP'
  | 'CREDIT_CARD'
  | 'AADHAAR'
  | 'PAN'
  | 'PASSWORD'
  | 'API_KEY'
  | 'PERSON_NAME'
  | 'ADDRESS'
  | 'IP_ADDRESS'
  | 'DOB';

/** How a detected entity should be treated before anything leaves the device. */
export type RedactionAction = 'REDACT' | 'MASK' | 'HASH' | 'DROP' | 'KEEP';

/** Sensitivity tier drives both redaction and action policy. */
export type Sensitivity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SensitiveEntity {
  id: string;
  type: SensitiveType;
  /** The raw matched value. This NEVER leaves the device. */
  value: string;
  /** A safe placeholder that may leave the device, e.g. "[REDACTED:EMAIL]". */
  placeholder: string;
  confidence: number; // 0..1
  sensitivity: Sensitivity;
  action: RedactionAction;
  /** DOM element identifier where it was found. */
  elementId?: string;
  /** Character offsets within the source text block. */
  start?: number;
  end?: number;
  /** For visual/bounding-box style redaction on screenshots. */
  box?: BoundingBox;
  reason: string;
  /** Detector that produced this hit — regex rule name or model name. */
  detector: string;
}

// ---------------------------------------------------------------------------
// Local perception (DOM + text + vision)
// ---------------------------------------------------------------------------

export type ElementRole =
  | 'heading'
  | 'text'
  | 'button'
  | 'link'
  | 'input'
  | 'image'
  | 'form'
  | 'nav'
  | 'status'
  | 'price'
  | 'label';

export interface PerceivedElement {
  id: string;
  role: ElementRole;
  text: string;
  /** e.g. input type=password, aria-label, etc. */
  attributes?: Record<string, string>;
  box?: BoundingBox;
  /** True if this element is interactive (clickable / fillable). */
  interactive?: boolean;
}

export interface PagePerception {
  url: string;
  title: string;
  pageType: string; // classified locally, e.g. "ecommerce_order_page"
  elements: PerceivedElement[];
  /** Raw combined text used for text-based PII detection. */
  rawText: string;
  screenshotUri?: string;
}

// ---------------------------------------------------------------------------
// Context compilation
// ---------------------------------------------------------------------------

export interface CompiledContext {
  intent: string;
  pageType: string;
  /** Only task-relevant, already-sanitized elements. */
  visibleElements: string[];
  /** Structured task-relevant fields (sanitized). */
  fields: Record<string, string | number | boolean | null>;
  /** Interactive targets the remote model may reference. */
  actionableTargets: { id: string; label: string; role: ElementRole }[];
}

export interface CompilationStats {
  rawChars: number;
  compiledChars: number;
  reductionPct: number;
  elementsIn: number;
  elementsOut: number;
  sensitiveRemoved: number;
}

// ---------------------------------------------------------------------------
// Agent action + policy
// ---------------------------------------------------------------------------

export type ActionType =
  | 'CLICK'
  | 'SCROLL'
  | 'NAVIGATE'
  | 'SELECT'
  | 'FILL'
  | 'SUBMIT'
  | 'PURCHASE'
  | 'REVEAL_CREDENTIAL'
  | 'DOWNLOAD';

export interface AgentAction {
  type: ActionType;
  targetId?: string;
  targetLabel?: string;
  value?: string;
  rationale: string;
}

export type PolicyDecisionType = 'ALLOW' | 'CONFIRM' | 'BLOCK';

export interface PolicyDecision {
  decision: PolicyDecisionType;
  rule: string;
  reason: string;
  action: AgentAction;
}

// ---------------------------------------------------------------------------
// Pipeline stages / tasks
// ---------------------------------------------------------------------------

export type TaskStage =
  | 'QUEUED'
  | 'PERCEIVING'
  | 'SANITIZING'
  | 'COMPILING'
  | 'REASONING'
  | 'POLICY_CHECK'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'BLOCKED';

export interface StageTiming {
  stage: TaskStage;
  ms: number;
}

export interface PipelineResult {
  taskId: string;
  task: string;
  scenarioId: string;
  perception: PagePerception;
  entities: SensitiveEntity[];
  compiled: CompiledContext;
  stats: CompilationStats;
  action: AgentAction;
  policy: PolicyDecision;
  timings: StageTiming[];
  totalMs: number;
  /** Exact JSON payload transmitted to the server. */
  transmittedPayload: unknown;
  /** Bytes that WOULD have been sent by a naive raw-screenshot baseline. */
  baselineBytes: number;
  sanitizedBytes: number;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export type AuditCategory = 'PRIVACY' | 'AI' | 'ACTION' | 'ERROR' | 'SYSTEM';

export interface AuditEvent {
  id: string;
  ts: string;
  category: AuditCategory;
  code: string;
  message: string;
  ok: boolean;
  meta?: Record<string, unknown>;
}
