// Combines several single-photo analyses into one Style DNA read. Pure
// arithmetic over the model's own percentages; nothing is invented.
import { AnalysisResult } from '../data';

export function combineReads(reads: AnalysisResult[]): AnalysisResult {
  const totals = new Map<string, number>();
  for (const r of reads) {
    for (const a of r.aesthetics) totals.set(a.label, (totals.get(a.label) ?? 0) + a.pct);
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((s, [, v]) => s + v, 0) || 1;
  const aesthetics = top.map(([label, v]) => ({ label, pct: Math.round((v / sum) * 100) }));
  // Rounding can leave the total at 99 or 101; settle the difference on the lead.
  if (aesthetics.length) aesthetics[0].pct += 100 - aesthetics.reduce((s, a) => s + a.pct, 0);

  const tagCounts = new Map<string, number>();
  for (const r of reads) for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

  const lead = aesthetics[0];
  const second = aesthetics[1];
  const insight = lead
    ? `Across ${reads.length} photos, ${lead.label} leads at ${lead.pct}%`
      + (second ? `, with ${second.label} close behind at ${second.pct}%.` : '.')
    : 'We need a few more photos to read your style.';
  return { aesthetics, tags, insight };
}
