/** Normalized `drivers.applicationStatus` / related API strings treated as cleared for Driver mode. */

const STRONG_APPROVED_TAIL = new Set([
  'approved',
  'active',
  'verified',
  'accepted',
  'accept',
  'complete',
  'completed',
  'authorized',
  'authorised',
  'validated',
  'passed',
  'eligible',
]);

const SOFT_APPROVED_FULL = new Set([
  ...STRONG_APPROVED_TAIL,
  'success',
  'successful',
  'cleared',
  'ok',
  'enabled',
  'authorize',
  'verification_complete',
  'passed_review',
]);

/** Non-terminal states — must not infer approval from substring/tail hacks. */
const NON_TERMINAL_PREFIX =
  /^(pending|submit|submission|processing|queued|waiting|review|await|in_progress|incomplete|draft|resubmit)/;

export function isDriverApplicationApprovedNormalized(status: string | null | undefined): boolean {
  if (!status) return false;
  const raw = status.trim().toLowerCase().replace(/\s+/g, '_');
  if (!raw) return false;

  if (/(reject|declin|denied|suspend|revoked|blocked|fail|cancel|hold|banned)/.test(raw)) {
    return false;
  }

  if (SOFT_APPROVED_FULL.has(raw)) return true;

  /** Safe tail only for strong terminals (avoids matching `confirmation` inside `pending_confirmation`). */
  const tailToken = raw.split('_').pop() ?? raw;
  if (STRONG_APPROVED_TAIL.has(tailToken)) return true;

  /** Composite values e.g. `driver_application_accepted`, `registration_approved`. */
  if (!NON_TERMINAL_PREFIX.test(raw) && /(_|^)(approved|accepted|verified|authorized|authorised)(_|$)/.test(raw)) {
    return true;
  }

  return false;
}
