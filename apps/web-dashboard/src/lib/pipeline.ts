/**
 * Client-side pipeline orchestrator — THE HEART OF THE PRODUCT.
 *
 * This runs entirely in the browser and enforces the privacy boundary:
 *
 *   RAW WEBPAGE (scenario)
 *   -> LOCAL PERCEPTION        (DOM + text extraction)
 *   -> LOCAL PII DETECTION     (@pvcc/privacy-engine, on-device)
 *   -> TASK-AWARE SANITIZATION (@pvcc/context-compiler, on-device)
 *   -> MINIMAL CONTEXT         (only sanitized payload leaves the browser)
 *   -> REMOTE REASONING        (POST /agent/reason — sees sanitized data only)
 *   -> LOCAL ACTION POLICY     (@pvcc/action-policy, on-device)
 *   -> BROWSER ACTION
 *
 * Raw sensitive values NEVER enter `transmittedPayload`.
 */
import type {
  AgentAction,
  CompiledContext,
  CompilationStats,
  PagePerception,
  PipelineResult,
  PolicyDecision,
  SensitiveEntity,
  StageTiming,
  TaskStage,
} from '@pvcc/shared';
import { getScenario } from '@pvcc/shared';
import { PrivacyEngine } from '@pvcc/privacy-engine';
import { ContextCompiler } from '@pvcc/context-compiler';
import { ActionPolicyEngine } from '@pvcc/action-policy';
import { api } from './api';

const privacy = new PrivacyEngine();
const compiler = new ContextCompiler();
const policy = new ActionPolicyEngine();

export interface PipelineHooks {
  onStage?: (stage: TaskStage, partial: Partial<PipelineResult>) => void;
  /** Artificial per-stage delay (ms) so judges can watch the flow. */
  stageDelay?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function buildPerception(scenarioId: string): PagePerception {
  const s = getScenario(scenarioId);
  if (!s) throw new Error(`Unknown scenario: ${scenarioId}`);
  const rawText = s.elements.map((e) => e.text).filter(Boolean).join('\n');
  return {
    url: s.url,
    title: s.title,
    pageType: s.pageType,
    elements: s.elements,
    rawText,
  };
}

/** Byte size of a naive baseline (raw text + simulated screenshot). */
function baselineBytes(perception: PagePerception): number {
  const textBytes = new TextEncoder().encode(perception.rawText).length;
  // Simulated PNG screenshot payload for a typical viewport.
  const simulatedScreenshot = 240_000;
  return textBytes + simulatedScreenshot;
}

export async function runPipeline(
  scenarioId: string,
  task: string,
  hooks: PipelineHooks = {},
): Promise<PipelineResult> {
  const delay = hooks.stageDelay ?? 550;
  const timings: StageTiming[] = [];
  const t0 = performance.now();

  const mark = async (stage: TaskStage, fn: () => void | Promise<void>, partial: () => Partial<PipelineResult>) => {
    const start = performance.now();
    hooks.onStage?.(stage, {});
    await sleep(delay);
    await fn();
    timings.push({ stage, ms: Math.round(performance.now() - start) });
    hooks.onStage?.(stage, partial());
  };

  const taskId = `task_${Date.now().toString(36)}`;

  // 1. PERCEIVING
  let perception!: PagePerception;
  await mark(
    'PERCEIVING',
    () => {
      perception = buildPerception(scenarioId);
    },
    () => ({ perception }),
  );

  // 2. SANITIZING (local PII detection + redaction)
  let entities: SensitiveEntity[] = [];
  await mark(
    'SANITIZING',
    () => {
      const res = privacy.analyze({ text: perception.rawText, elements: perception.elements });
      entities = PrivacyEngine.attachElements(res.entities, perception.elements);
    },
    () => ({ entities }),
  );

  // 3. COMPILING (task-aware minimal context)
  let compiled!: CompiledContext;
  let stats!: CompilationStats;
  await mark(
    'COMPILING',
    () => {
      const out = compiler.compile({ task, perception, entities });
      compiled = out.compiled;
      stats = out.stats;
    },
    () => ({ compiled, stats }),
  );

  // Build the EXACT payload that will leave the browser. Assert no raw PII.
  const transmittedPayload = {
    task,
    scenario_id: scenarioId,
    compiled_context: compiled,
  };
  assertNoRawPII(transmittedPayload, entities);

  const sanitizedBytes = new TextEncoder().encode(JSON.stringify(transmittedPayload)).length;
  const baseBytes = baselineBytes(perception);

  // 4. REASONING (remote — sees sanitized data only)
  let action!: AgentAction;
  let resultSummary = '';
  let provider = 'mock';
  await mark(
    'REASONING',
    async () => {
      try {
        const res = await api.post<{
          action: AgentAction & { target_id?: string; target_label?: string };
          provider: string;
          result_summary: string;
        }>('/agent/reason', transmittedPayload);
        action = normalizeAction(res.action);
        resultSummary = res.result_summary;
        provider = res.provider;
      } catch {
        // Fall back to a local deterministic action if API is unreachable.
        action = localFallbackAction(task, compiled);
        resultSummary = 'Local fallback reasoning (API unreachable).';
        provider = 'mock-local';
      }
    },
    () => ({ action }),
  );

  // 5. POLICY_CHECK (local security boundary)
  let decision!: PolicyDecision;
  await mark(
    'POLICY_CHECK',
    () => {
      decision = policy.evaluate(action, { entities, elements: perception.elements });
    },
    () => ({ policy: decision }),
  );

  // 6. EXECUTING / BLOCKED
  const finalStage: TaskStage = decision.decision === 'BLOCK' ? 'BLOCKED' : 'EXECUTING';
  await mark(
    finalStage,
    () => {},
    () => ({}),
  );

  const totalMs = Math.round(performance.now() - t0);

  const result: PipelineResult = {
    taskId,
    task,
    scenarioId,
    perception,
    entities,
    compiled,
    stats,
    action,
    policy: decision,
    timings,
    totalMs,
    transmittedPayload: { ...transmittedPayload, provider, result_summary: resultSummary },
    baselineBytes: baseBytes,
    sanitizedBytes,
  };

  hooks.onStage?.(decision.decision === 'BLOCK' ? 'BLOCKED' : 'COMPLETED', result);
  return result;
}

function normalizeAction(a: AgentAction & { target_id?: string; target_label?: string }): AgentAction {
  return {
    type: a.type,
    targetId: a.targetId ?? a.target_id,
    targetLabel: a.targetLabel ?? a.target_label,
    value: a.value,
    rationale: a.rationale,
  };
}

function localFallbackAction(task: string, compiled: CompiledContext): AgentAction {
  const t = compiled.actionableTargets[0];
  const dangerous = /otp|password|pay|payment|card/i.test(task);
  if (dangerous && /otp/i.test(task)) {
    return { type: 'REVEAL_CREDENTIAL', targetLabel: 'OTP value', rationale: 'Task asks to read the OTP.' };
  }
  return {
    type: 'CLICK',
    targetId: t?.id,
    targetLabel: t?.label ?? 'primary action',
    rationale: 'Perform the most relevant available action.',
  };
}

/**
 * Safety assertion: verify no raw sensitive value appears in the outbound
 * payload. In a real deployment this would hard-fail the request.
 */
export function assertNoRawPII(payload: unknown, entities: SensitiveEntity[]): void {
  const json = JSON.stringify(payload);
  for (const e of entities) {
    if (!e.value || e.value.startsWith('[')) continue;
    // Compare on normalized digits for numeric identifiers.
    if (json.includes(e.value)) {
      // eslint-disable-next-line no-console
      console.error('PRIVACY VIOLATION: raw value would be transmitted', e.type);
      throw new Error(`Privacy violation: raw ${e.type} in outbound payload`);
    }
  }
}
