#!/usr/bin/env node
// Prints onboarding and cost metrics from our own Supabase project.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/metrics.mjs [--json]
import 'dotenv/config';
import { computeMetrics } from '../server/growth.js';

const fmt = (v, digits = 2) =>
  v == null ? 'n/a' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(digits)) : String(v);
const pct = (v) => (v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`);

try {
  const m = await computeMetrics();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(m, null, 2));
    process.exit(0);
  }
  const s = m.summary;
  console.log(`outft. metrics  (${m.generated_at})\n`);
  console.log(`users                            ${s.users}`);
  console.log(`median time to first DNA read    ${fmt(s.median_seconds_to_first_dna, 0)} s`);
  console.log(`median photos before first read  ${fmt(s.median_photos_before_first_dna)}`);
  console.log(`avg photos uploaded              ${fmt(s.avg_photos_uploaded)}`);
  console.log(`uploaded after twin match        ${pct(s.upload_after_twin_match_rate)}`);
  console.log(`avg sessions                     ${fmt(s.avg_sessions)}`);
  console.log(`day-1 return                     ${pct(s.day1_return_rate)}`);
  console.log(`day-7 return                     ${pct(s.day7_return_rate)}`);
  console.log(`analyses logged                  ${s.analyses_logged}`);
  console.log(`avg tokens per analysis          ${fmt(s.avg_tokens_per_analysis, 0)}`);
  console.log(`avg cost per analysis            $${fmt(s.avg_cost_per_analysis_usd, 4)}`);
  console.log(`total AI cost                    $${fmt(s.total_ai_cost_usd, 4)}`);
  console.log(`onboarding cost (cost per analysis x photos to value)  $${fmt(s.onboarding_cost_usd, 4)}`);
  const x = s.sharpen_experiment;
  console.log(`sharpen prompt: shown ${x.shown}, tapped ${x.tapped}, uploaded after tap ${x.uploaded_after_tap}\n`);
  console.log('per user:');
  console.table(m.users.map((u) => ({
    user: u.user_id.slice(0, 8),
    photos: u.photos_uploaded,
    secs_to_dna: u.seconds_to_first_dna,
    photos_to_dna: u.photos_before_first_dna,
    after_twin: u.uploaded_after_twin_match,
    sessions: u.sessions,
    d1: u.day1_return,
    d7: u.day7_return,
  })));
} catch (e) {
  console.error(`metrics failed: ${e.message}`);
  process.exit(1);
}
