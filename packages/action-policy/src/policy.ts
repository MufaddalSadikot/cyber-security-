/**
 * ActionPolicyEngine — the LOCAL security boundary.
 *
 * The remote AI may only *propose* actions. This engine, running on-device,
 * decides ALLOW / CONFIRM / BLOCK. Critically, dangerous actions (revealing an
 * OTP/password/payment credential) are BLOCKED here regardless of what the
 * remote model asked for — the boundary is enforced locally, not trusted to
 * the server.
 */
import type {
  AgentAction,
  PolicyDecision,
  SensitiveEntity,
  PerceivedElement,
} from '@pvcc/shared';

export interface PolicyContext {
  entities: SensitiveEntity[];
  elements: PerceivedElement[];
}

interface Rule {
  name: string;
  test: (a: AgentAction, ctx: PolicyContext) => boolean;
  decision: 'ALLOW' | 'CONFIRM' | 'BLOCK';
  reason: string;
}

const CRITICAL = new Set(['OTP', 'PASSWORD', 'CREDIT_CARD', 'API_KEY']);

/** Does the target element hold or expose a critical credential? */
function targetsCredential(a: AgentAction, ctx: PolicyContext): boolean {
  const el = ctx.elements.find((e) => e.id === a.targetId);
  if (el?.attributes?.type === 'password') return true;
  const critical = ctx.entities.filter((e) => CRITICAL.has(e.type));
  if (a.value) {
    for (const e of critical) {
      const digits = e.value.replace(/\D/g, '');
      if (a.value.includes(e.value) || (digits.length >= 4 && a.value.replace(/\D/g, '').includes(digits)))
        return true;
    }
  }
  if (el && critical.some((e) => e.elementId === el.id)) return true;
  return false;
}

const RULES: Rule[] = [
  // --- HARD BLOCKS (evaluated first) ---
  {
    name: 'block.reveal_credential',
    test: (a) => a.type === 'REVEAL_CREDENTIAL',
    decision: 'BLOCK',
    reason: 'Revealing OTP/password/payment credentials is prohibited by local policy.',
  },
  {
    name: 'block.fill_credential_from_remote',
    test: (a, ctx) => a.type === 'FILL' && targetsCredential(a, ctx),
    decision: 'BLOCK',
    reason: 'Remote AI attempted to write into a credential/OTP/password field. Blocked locally.',
  },
  {
    name: 'block.transmit_credential',
    test: (a, ctx) => targetsCredential(a, ctx) && a.type !== 'CLICK',
    decision: 'BLOCK',
    reason: 'Action would expose a critical credential. Blocked locally.',
  },
  {
    name: 'block.download_sensitive',
    test: (a, ctx) =>
      a.type === 'DOWNLOAD' &&
      ctx.entities.some((e) => e.sensitivity === 'CRITICAL' || e.sensitivity === 'HIGH'),
    decision: 'BLOCK',
    reason: 'Downloading a document while sensitive identity data is present requires manual review.',
  },
  // --- CONFIRMATION REQUIRED ---
  {
    name: 'confirm.purchase',
    test: (a) => a.type === 'PURCHASE',
    decision: 'CONFIRM',
    reason: 'Purchases require explicit human confirmation.',
  },
  {
    name: 'confirm.submit',
    test: (a) => a.type === 'SUBMIT',
    decision: 'CONFIRM',
    reason: 'Submitting a form requires explicit human confirmation.',
  },
  {
    name: 'confirm.settings_change',
    test: (a) =>
      (a.type === 'CLICK' || a.type === 'SELECT') &&
      /account settings|change|delete|deactivate/i.test(a.targetLabel ?? ''),
    decision: 'CONFIRM',
    reason: 'Changing account settings requires explicit human confirmation.',
  },
  {
    name: 'confirm.download',
    test: (a) => a.type === 'DOWNLOAD',
    decision: 'CONFIRM',
    reason: 'Downloading a file requires human confirmation.',
  },
  // --- ALLOW ---
  {
    name: 'allow.navigation',
    test: (a) => a.type === 'CLICK' || a.type === 'NAVIGATE' || a.type === 'SCROLL',
    decision: 'ALLOW',
    reason: 'Public navigation / scroll is permitted.',
  },
  {
    name: 'allow.fill_public',
    test: (a, ctx) => a.type === 'FILL' && !targetsCredential(a, ctx),
    decision: 'ALLOW',
    reason: 'Filling a non-sensitive public field is permitted.',
  },
  {
    name: 'allow.select_public',
    test: (a) => a.type === 'SELECT',
    decision: 'ALLOW',
    reason: 'Selecting a non-sensitive option is permitted.',
  },
];

export class ActionPolicyEngine {
  evaluate(action: AgentAction, ctx: PolicyContext): PolicyDecision {
    for (const rule of RULES) {
      if (rule.test(action, ctx)) {
        return { decision: rule.decision, rule: rule.name, reason: rule.reason, action };
      }
    }
    return {
      decision: 'CONFIRM',
      rule: 'default.confirm',
      reason: 'No explicit allow rule matched; defaulting to human confirmation.',
      action,
    };
  }

  /** Static policy catalogue for the UI. */
  static catalogue() {
    return RULES.map((r) => ({ name: r.name, decision: r.decision, reason: r.reason }));
  }
}
