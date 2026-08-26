/**
 * Lightweight local intent classifier. Maps a free-text task to a canonical
 * intent plus a set of keywords used for task-relevance scoring. This is the
 * seam where a small on-device classifier model could later be plugged in.
 */
export interface Intent {
  intent: string;
  keywords: string[];
  /** Roles that are inherently relevant to this intent. */
  relevantRoles: string[];
}

const INTENTS: { match: RegExp; intent: Intent }[] = [
  {
    match: /\b(order|status|track|shipment|delivery|parcel)\b/i,
    intent: {
      intent: 'track_order',
      keywords: ['order', 'status', 'shipped', 'delivery', 'track', 'expected'],
      relevantRoles: ['status', 'price', 'button', 'link'],
    },
  },
  {
    match: /\b(cheapest|flight|price|book|fare)\b/i,
    intent: {
      intent: 'find_cheapest',
      keywords: ['price', 'cheapest', 'fare', 'flight', 'total'],
      relevantRoles: ['price', 'button', 'link', 'text'],
    },
  },
  {
    match: /\b(fill|register|form|sign\s?up|registration)\b/i,
    intent: {
      intent: 'fill_form',
      keywords: ['name', 'organization', 'track', 'submit', 'next', 'register'],
      relevantRoles: ['input', 'label', 'button'],
    },
  },
  {
    match: /\b(settings?|preferences|configuration)\b/i,
    intent: {
      intent: 'open_settings',
      keywords: ['settings', 'account', 'preferences'],
      relevantRoles: ['link', 'button', 'nav'],
    },
  },
  {
    match: /\b(profile|account|identity)\b/i,
    intent: {
      intent: 'open_profile',
      keywords: ['profile', 'account', 'membership', 'name'],
      relevantRoles: ['link', 'button', 'heading'],
    },
  },
  {
    match: /\b(otp|password|pay|payment|card|credential|complete the payment)\b/i,
    intent: {
      intent: 'complete_payment',
      keywords: ['pay', 'amount', 'payee', 'confirm'],
      relevantRoles: ['button', 'price', 'text'],
    },
  },
  {
    match: /\b(navigate|open|go to|scroll|find)\b/i,
    intent: {
      intent: 'navigate',
      keywords: ['open', 'section', 'page', 'nav'],
      relevantRoles: ['link', 'button', 'nav', 'heading'],
    },
  },
];

export function classifyIntent(task: string): Intent {
  for (const { match, intent } of INTENTS) {
    if (match.test(task)) return intent;
  }
  return {
    intent: 'generic_task',
    keywords: task.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
    relevantRoles: ['link', 'button', 'text', 'heading'],
  };
}
