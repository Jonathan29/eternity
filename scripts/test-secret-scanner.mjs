import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const executable = process.argv[2] || 'gitleaks';
const synthetic = randomBytes(32).toString('hex');
const samples = [
  ['supabase-secret', ['sb', 'secret', synthetic].join('_')],
  ['supabase-service-jwt', `SUPABASE_SERVICE_ROLE_KEY="${['eyJhbGciOiJIUzI1NiJ9', 'eyJyb2xlIjoic2VydmljZV9yb2xlIn0', synthetic].join('.')}"`],
  ['api-bible-assignment', `API_BIBLE_KEY=${synthetic}`],
  ['posthog-assignment', `POSTHOG_API_KEY="${synthetic}"`],
  ['fcm-apns-assignment', `FCM_SERVER_KEY="${synthetic}"`],
  ['fcm-apns-assignment', `APNS_TOKEN=${synthetic}`],
  ['gcp-api-key', ['AI', 'za', randomBytes(48).toString('base64url').slice(0, 35)].join('')],
  ['private-key', ['-----BEGIN PRIVATE', 'KEY-----\n', synthetic, '\n-----END PRIVATE', 'KEY-----'].join(' ')],
];
for (const [rule, source] of samples) {
  const result = spawnSync(executable, ['stdin', '--redact=100', '--no-banner', '--config=.gitleaks.toml', '--log-level=error', '--verbose'], {
    input: source, encoding: 'utf8', windowsHide: true,
  });
  assert.equal(result.status, 1, `${rule}: synthetic credential was not rejected`);
  assert((result.stdout + result.stderr).includes(rule), `${rule}: expected rule missing`);
  console.log(`PASS: synthetic ${rule} rejected (value omitted).`);
}
const clean = spawnSync(executable, ['stdin', '--redact=100', '--no-banner', '--config=.gitleaks.toml', '--log-level=error'], {
  input: 'const message = "Safe site source";', encoding: 'utf8', windowsHide: true,
});
assert.equal(clean.status, 0, 'Clean source must pass');
console.log('PASS: clean source accepted.');
