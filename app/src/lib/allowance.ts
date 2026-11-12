// Free-tier counting (only enforced when the pricing flag is on). The server
// enforces the same rule for signed-in users; this local count covers the UI
// and guests. Free: the first 5 analyses, then 2 per calendar month.
import { FLAGS, FREE_INTRO_ANALYSES, FREE_MONTHLY_ANALYSES } from '../flags';

export interface Allowance {
  allowed: boolean;
  introLeft: number;
  monthLeft: number;
}

export function allowanceFrom(log: string[], isPremium: boolean, now = new Date()): Allowance {
  if (!FLAGS.pricing || isPremium) return { allowed: true, introLeft: Infinity, monthLeft: Infinity };
  const sorted = [...log].sort();
  const introLeft = Math.max(0, FREE_INTRO_ANALYSES - sorted.length);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const usedThisMonth = sorted.slice(FREE_INTRO_ANALYSES).filter((t) => t >= monthStart).length;
  const monthLeft = Math.max(0, FREE_MONTHLY_ANALYSES - usedThisMonth);
  return { allowed: introLeft > 0 || monthLeft > 0, introLeft, monthLeft };
}
